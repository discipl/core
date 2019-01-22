import crypto from 'crypto-js'
import { loadConnector } from './connector-loader'
import { Observable } from 'rxjs'
import { filter, map, concat } from 'rxjs/operators'

const DID_DELIMITER = ':'
const MAX_DEPTH_REACHED = 'MAX_DEPTH_REACHED'
const LINK_PREFIX = 'link' + DID_DELIMITER + 'discipl' + DID_DELIMITER
const DID_PREFIX = 'did' + DID_DELIMITER + 'discipl' + DID_DELIMITER
const REVOKE_PREDICATE = 'revoke'

var disciplCoreConnectors = []

/**
 * @module discipl-core
 */

/**
 * requires and holds in memory the given discipl connector (if not done before)
 */
const initializeConnector = async (connectorName) => {
  if (!Object.keys(disciplCoreConnectors).includes(connectorName)) {
    let ConnectorModuleClass = await loadConnector(connectorName)
    registerConnector(connectorName, new ConnectorModuleClass())
  }
}

/**
 * returns the connector object of the given discipl connector. Automaticly lazy loads the corresponding module
 */
const getConnector = async (connector) => {
  await initializeConnector(connector)
  return disciplCoreConnectors[connector]
}

/**
 * Registers a connector explicitly.
 *
 * @param name of the connector. Packages containing a connector follow the naming convention CONNECTOR_MODULE_PREFIX + name
 * @param connector instantiated object representing the connector
 */
const registerConnector = (name, connector) => {
  disciplCoreConnectors[name] = connector
}

/**
 * extracts connector name and reference from a link string and returns it as a json object in the form of: {connector, reference}
 */
const splitLink = (link) => {
  let splitted = link.split(DID_DELIMITER)
  let connector = splitted[2]
  let reference = splitted.slice(3).join(DID_DELIMITER)
  return { 'connector': connector, 'reference': reference }
}

/**
 * returns a link string for the given claim in the channel of the given ssid. claim can be a string in which case it needs to be a connector specific reference string, or it is a object holding claim(s) of which the hash of the stringified version is used as reference
 */
const getLink = (ssid, claim, connectorName = null) => {
  if (claim) {
    let connector = connectorName != null ? connectorName : ssid.connector.getName()
    if (typeof claim === 'string') {
      return LINK_PREFIX + connector + DID_DELIMITER + claim
    } else {
      return LINK_PREFIX + connector + DID_DELIMITER + getHash(ssid, claim)
    }
  }
  return null
}

/**
 * checks if a given string seems to be a valid link (correct syntax and refers to an available connector). Does not check the claim the link refers to exists or not. The reference is not checked
 */
const isValidLink = async (link) => {
  try {
    let connector = splitLink(link).connector
    await getConnector(connector)
    return link.indexOf(LINK_PREFIX) === 0
  } catch (e) {
    return false
  }
}

/**
 * Retrieves an Ssid object for the claim referenced in the given link. Note that the Ssid object will not contain the private key for obvious reasons
 */
const getSsidOfLinkedClaim = async (link) => {
  let { connector, reference } = splitLink(link)
  let conn = await getConnector(connector)
  let ssid = await conn.getSsidOfClaim(reference)
  return { 'did': DID_PREFIX + conn.getName() + DID_DELIMITER + ssid.pubkey }
}

/**
 * returns a HMAC-384 peppered hash of the given data with the did of the given ssid as key
 */
const getHash = (ssid, data) => {
  return crypto.enc.Base64.stringify(crypto.HmacSHA384(data, ssid.did))
}

const expandSsid = async (ssid) => {
  let splitted = ssid.did.split(DID_DELIMITER)
  ssid['connector'] = await getConnector(splitted[2])
  ssid['pubkey'] = splitted[3]
  return ssid
}

/**
 * Generates a new ssid, a json object in the form of: {connector:connectorObj, did:did, pubkey:pubkey, privkey:privkey}, for the platform the given discipl connector name adds support for
 */
const newSsid = async (connector) => {
  let conn = await getConnector(connector)
  let ssid = await conn.newSsid()
  ssid['connector'] = conn
  ssid['did'] = DID_PREFIX + conn.getName() + DID_DELIMITER + ssid.pubkey
  return ssid
}

/**
 * Adds a claim to the (end of the) channel of the given ssid (containing the did and probably privkey as only requirement). Returns a link to this claim.
 */
const claim = async (ssid, data) => {
  await expandSsid(ssid)
  let reference = await ssid.connector.claim(ssid, data)
  return getLink(ssid, reference)
}

/**
 * Adds an attestation claim of the claim the given link refers to using the given predicate in the channel of the given ssid
 */
const attest = async (ssid, predicate, link) => {
  let attest = {}
  attest[predicate] = link
  return claim(ssid, attest)
}

/**
 * Will verify existence of an attestation of the claim referenced in the given link and mentioning the given predicate.
 * It will check the channels of the given ssid's. By default it will return the first ssid whose channel contained a matching attestation.
 * You can also make this method check the channel of every ssid after which the method will return an array of all ssid's that have attested.
 * If the referenced claim or an attestation itself are revoked, the method will not evaluate the claim as been attested.
 * If none of the given ssid's have attested, the method returns null
 */
const verify = async (predicate, link, ssids, all = false) => {
  let result = []
  for (let i in ssids) {
    let ssid = ssids[i]
    if (!(ssid)) continue
    await expandSsid(ssid)
    let attestation = {}
    attestation[predicate] = link
    let reference = await ssid.connector.verify(ssid, attestation)
    if (reference) {
      if (await verify(REVOKE_PREDICATE, getLink(ssid, reference), [ssid]) == null) {
        if (predicate === REVOKE_PREDICATE || await verify(REVOKE_PREDICATE, link, [await getSsidOfLinkedClaim(link)]) == null) {
          if (all) {
            result.push(ssid)
          } else {
            return ssid
          }
        }
      }
    }
  }
  if (result.length === 0) { return null }
  return result
}

/**
 * Retrieves the data of the claim a given link refers to along with a link to the previous claim in the same channel.
 * @param {string} link - link to the claim of which the data should be retreved
 * @param {json} ssid - Optional : the ssid of the actor (on the same platform as the claim the links refers to) that wants to get the data but may not have permission without identifying itself
 * @return {json} - {data, linkToPrevious}
 */
const get = async (link, ssid = null) => {
  let { connector, reference } = splitLink(link)
  let conn = await getConnector(connector)
  let result = await conn.get(reference, ssid)
  result.previous = getLink({ 'connector': conn }, result.previous)
  return result
}

/**
 * Subscribes a given callback function to be called when new claims are found with given parameters.
 *
 * @param ssid {object} ssid to filter claims
 * @param claimFilter {object} filters by the content of claims
 * @param historical {boolean} if true, the result will start at the beginning of the channel
 * @param connector {object} needs to be provided in order to listen platform-wide without ssid
 * @returns {Promise<Observable<any>>}
 */
const observe = async (ssid, claimFilter, historical = false, connector = null) => {
  if (connector != null && ssid == null) {
    return observeAll(connector, claimFilter)
  }
  if (ssid == null) {
    throw Error('Observe without ssid or connector is not supported')
  }

  let expandedSsid = await expandSsid(ssid)
  let currentObservable = (await expandedSsid.connector.observe(ssid, claimFilter))
    .pipe(map(claim => {
      claim['claim'].previous = getLink(expandedSsid, claim['claim'].previous)
      return claim
    }))

  if (!historical) {
    return currentObservable
  }

  let historyObservable = Observable.create(async (observer) => {
    let latestClaim = getLink(ssid, await expandedSsid.connector.getLatestClaim(ssid))

    let claims = []

    let current = await get(latestClaim)
    while (current != null) {
      current['ssid'] = ssid
      claims.unshift(current)

      if (current.previous) {
        current = await get(current.previous)
      } else {
        current = null
      }
    }

    for (let claim of claims) {
      observer.next(claim)
    }
  }).pipe(filter(claim => {
    if (claimFilter != null) {
      for (let predicate of Object.keys(claimFilter)) {
        if (claim['claim']['data'][predicate] == null) {
          // Predicate not present in claim
          return false
        }

        if (claimFilter[predicate] != null && claimFilter[predicate] !== claim['claim']['data'][predicate]) {
          // Object is provided in filter, but does not match with actual claim
          return false
        }
      }
    }
    return true
  }))

  return historyObservable.pipe(concat(currentObservable))
}

const observeAll = async (connector, claimFilter) => {
  return (await connector.observe(null, claimFilter)).pipe(map(claim => {
    claim['claim'].previous = getLink(null, claim['claim'].previous, connector.getName())
    return claim
  }))
}

/**
 * Helper method for exportLD which detects a value to be a ssid, did or link and returns the ssid and link (the one given or to the latest claim in a channel of a did/ssid) or null otherwise
 * throws error when given a object intended to be a ssid but isn't
 */
const detectSsidLinkFromDidSsidOrLink = async (value) => {
  let currentLink = null
  let currentSsid = null
  let withPrevious = false
  if (typeof value === 'string') {
    if (await isValidLink(value)) {
      currentLink = value
      currentSsid = await getSsidOfLinkedClaim(currentLink)
    } else if (value.indexOf(DID_PREFIX) === 0) {
      currentSsid = await expandSsid({ 'did': value })
      currentLink = getLink(currentSsid, await currentSsid.connector.getLatestClaim(currentSsid))
      withPrevious = true
    } else {
      return null
    }
  } else if (Object.keys(value).includes('did')) {
    currentSsid = await expandSsid(value)
    currentLink = getLink(currentSsid, await currentSsid.connector.getLatestClaim(currentSsid))
    withPrevious = true
  } else {
    return null
  }
  return { 'ssid': currentSsid, 'link': currentLink, 'withPrevious': withPrevious }
}

/**
 * Exports linked claim data starting with the claim the given link refers to.
 * Links contained in the data of the claim are exported also in a value alongside of the link and links in data of those claims are processed in a same way too etc.
 * By default, expansion like this is done at most three times. You can alter this depth of the export by setting the second argument. If the maximum depth is reached the exported data
 * will contain the value MAX_DEPTH_REACHED alongside of the link instead of an exported dataset. You can use this method to iteratively expand the dataset using the link that was not followed.
 * A claim is never exported twice; circulair references are not followed.
 */
const exportLD = async (SsidDidOrLink, maxdepth = 3, ssid = null, visitedStack = [], withPrevious = false) => {
  let ssidlink = await detectSsidLinkFromDidSsidOrLink(SsidDidOrLink)
  if (ssidlink == null) {
    return SsidDidOrLink
  }
  let currentLink = ssidlink.link
  let currentSsid = ssidlink.ssid
  if (ssidlink.withPrevious) {
    withPrevious = true
  }

  if (visitedStack.length >= maxdepth) {
    return { SsidDidOrLink: MAX_DEPTH_REACHED }
  } else if (!withPrevious) {
    visitedStack.push(currentLink)
  }

  let channelData = []

  let res = await get(currentLink, ssid)

  if (res != null) {
    let data = res.data

    if (res.previous && withPrevious) {
      let prevData = await exportLD(res.previous, maxdepth, currentSsid.did, visitedStack, true)
      channelData = prevData[currentSsid.did]
    }

    let linkData = {}
    for (let elem in data) {
      if (data.hasOwnProperty(elem)) {
        let value = data[elem]
        try {
          linkData[elem] = await exportLD(value, maxdepth, ssid, visitedStack)
        } catch (err) {
          linkData[elem] = { [value]: { 'export-error': err } }
        }
      }
    }
    channelData.push({ [currentLink]: linkData })
  } else {
    channelData.push({ [currentLink]: 'NOT_FOUND' })
  }

  return { [currentSsid.did]: channelData }
}

/**
 * Adds a revocation attestation to the channel of the given ssid. Effectively revokes the claim the given link refers to. Subsequent verification of the claim will not succeed.
 * @param {json} ssid - The ssid json object. The attestation is added to the channel of this ssid
 * @param {string} link - The link to the claim (or attestation) that should be attested as being revoked. Note that this claim must be in the channel of the given ssid to be effectively seen as revoked.
 */
const revoke = async (ssid, link) => {
  return attest(ssid, REVOKE_PREDICATE, link)
}

export {
  getConnector,
  registerConnector,
  newSsid,
  claim,
  attest,
  verify,
  get,
  exportLD,
  revoke,
  observe,
  MAX_DEPTH_REACHED
}
