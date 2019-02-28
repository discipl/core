import { loadConnector } from './connector-loader'
import { Observable } from 'rxjs'
import { concat, filter, map } from 'rxjs/operators'
import { BaseConnector } from '../../discipl-core-baseconnector'

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
 * Retrieves an Ssid object for the claim referenced in the given link. Note that the Ssid object will not contain the private key for obvious reasons
 */
const getDidOfLinkedClaim = async (link) => {
  let connectorName = BaseConnector.getConnectorName(link)
  let conn = await getConnector(connectorName)
  return conn.getDidOfClaim(link)
}

/**
 * Generates a new ssid, a json object in the form of: {connector:connectorObj, did:did, pubkey:pubkey, privkey:privkey}, for the platform the given discipl connector name adds support for
 */
const newSsid = async (connector) => {
  let conn = await getConnector(connector)
  return conn.newIdentity()
}

/**
 * Adds a claim to the (end of the) channel of the given ssid (containing the did and probably privkey as only requirement). Returns a link to this claim.
 */
const claim = async (ssid, data) => {
  let connectorName = BaseConnector.getConnectorName(ssid.did)
  let connector = await getConnector(connectorName)
  let link = await connector.claim(ssid.did, ssid.privkey, data)
  return link
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
const verify = async (predicate, link, dids, all = false) => {
  let result = []
  for (let did of dids) {
    if (typeof did !== 'string') {
      continue
    }
    let connectorName = BaseConnector.getConnectorName(did)
    let connector = await getConnector(connectorName)
    let attestation = {}

    attestation[predicate] = link
    let attestationLink = await connector.verify(did, attestation)
    if (attestationLink) {
      if (await verify(REVOKE_PREDICATE, attestationLink, [did]) == null) {
        if (predicate === REVOKE_PREDICATE || await verify(REVOKE_PREDICATE, link, [await getDidOfLinkedClaim(link)]) == null) {
          if (all) {
            result.push(did)
          } else {
            return did
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
  let connectorName = BaseConnector.getConnectorName(link)
  let conn = await getConnector(connectorName)
  return conn.get(link, ssid)
}

/**
 * Subscribes a given callback function to be called when new claims are found with given parameters.
 *
 * @param did {string} did to filter claims
 * @param claimFilter {object} filters by the content of claims
 * @param historical {boolean} if true, the result will start at the beginning of the channel
 * @param connector {object} needs to be provided in order to listen platform-wide without ssid
 * @returns {Promise<Observable<any>>}
 */
const observe = async (did, claimFilter, historical = false, connector = null) => {
  if (connector != null && did == null) {
    return observeAll(connector, claimFilter)
  }
  if (did == null) {
    throw Error('Observe without did or connector is not supported')
  }

  let connectorName = BaseConnector.getConnectorName(did)
  connector = await getConnector(connectorName)
  let currentObservable = (await connector.observe(did, claimFilter))
    .pipe(map(claim => {
      return claim
    }))

  if (!historical) {
    return currentObservable
  }

  let historyObservable = Observable.create(async (observer) => {
    let latestClaim = await connector.getLatestClaim(did)

    let claims = []

    let current = await get(latestClaim)
    while (current != null) {
      claims.unshift({ 'claim': current, 'did': did })

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
    return claim
  }))
}

const isLink = (str) => {
  return typeof str === 'string' && str.startsWith(LINK_PREFIX)
}

const isDid = (str) => {
  return typeof str === 'string' && str.startsWith(DID_PREFIX)
}

/**
 * Exports linked claim data starting with the claim the given link refers to.
 * Links contained in the data of the claim are exported also in a value alongside of the link and links in data of those claims are processed in a same way too etc.
 * By default, expansion like this is done at most three times. You can alter this depth of the export by setting the second argument. If the maximum depth is reached the exported data
 * will contain the value MAX_DEPTH_REACHED alongside of the link instead of an exported dataset. You can use this method to iteratively expand the dataset using the link that was not followed.
 * A claim is never exported twice; circulair references are not followed.
 */
const exportLD = async (didOrLink, maxdepth = 3, ssid = null, visitedStack = [], withPrevious = false) => {
  let isDidBool = isDid(didOrLink)
  let isLinkBool = isLink(didOrLink)
  if (!isDidBool && !isLinkBool) {
    return didOrLink
  }

  let connectorName = BaseConnector.getConnectorName(didOrLink)
  let connector = await getConnector(connectorName)

  let currentDid = isDidBool ? didOrLink : await connector.getDidOfClaim(didOrLink)
  let currentLink = isLinkBool ? didOrLink : await connector.getLatestClaim(didOrLink)

  if (isDidBool) {
    withPrevious = true
  }

  if (visitedStack.length >= maxdepth) {
    return { didOrLink: MAX_DEPTH_REACHED }
  } else if (!withPrevious) {
    visitedStack.push(currentLink)
  }

  let channelData = []

  let res = await get(currentLink, ssid)
  if (res != null) {
    let data = res.data

    if (res.previous && withPrevious) {
      let prevData = await exportLD(res.previous, maxdepth, currentDid, visitedStack, true)
      channelData = prevData[currentDid]
    }

    let linkData = {}
    if (Array.isArray(data)) {
      linkData = []
    }

    for (let elem in data) {
      if (data.hasOwnProperty(elem)) {
        let value = data[elem]
        let exportValue = await exportLD(value, maxdepth, ssid, visitedStack)
        try {
          if (Array.isArray(data)) {
            linkData.push(exportValue)
          } else {
            linkData[elem] = exportValue
          }
        } catch (err) {
          linkData[elem] = { [value]: { 'export-error': err } }
        }
      }
    }

    channelData.push({ [currentLink]: linkData })
  } else {
    channelData.push({ [currentLink]: 'NOT_FOUND' })
  }

  return { [currentDid]: channelData }
}

/**
 * Imports claims given a dataset as returned by exportLD. Claims linked in the claims are not imported (so max depth = 1)
 * Not all connectors will support this method and its functioning may be platform specific. Some may actually let you
 * create claims in bulk through this import. Others will only check for existence and validate.
 */
const importLD = async (data) => {
  let succeeded = null
  for (let did in data) {
    if (did.indexOf(DID_PREFIX) !== 0) {
      continue
    }

    for (let i in data[did]) {
      let link = Object.keys(data[did][i])[0]
      let claim = data[did][i][link]
      let predicate = Object.keys(claim)[0]
      try {
        let res = await importLD(claim[predicate])
        if (res != null) {
          let nestedDid = Object.keys(claim[predicate])[0]
          let l = Object.keys(claim[predicate][nestedDid][0])[0]
          claim = { [predicate]: l }
        }
      } catch { }

      let connectorName = BaseConnector.getConnectorName(did)
      let connector = await getConnector(connectorName)

      let result = await connector.import(did, link, claim)
      if (result == null) {
        return null
      } else {
        succeeded = true
      }
    }
  }
  return succeeded
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
  importLD,
  revoke,
  observe,
  MAX_DEPTH_REACHED
}
