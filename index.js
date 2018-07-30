
const CryptoJS = require('crypto-js')

const DID_DELIMITER = ':'
const MAX_DEPTH_REACHED = 'MAX_DEPTH_REACHED'
const LINK_PREFIX = 'link'+DID_DELIMITER+'discipl'+DID_DELIMITER
const DID_PREFIX = 'did'+DID_DELIMITER+'discipl'+DID_DELIMITER
const REVOKE_PREDICATE = 'revoke'
const CONNECTOR_MODULE_PREFIX = 'discipl-core-'

var disciplCoreConnectors = []

/**
 * @module discipl-core
 */

/**
 * requires and holds in memory the given discipl connector (if not done before)
 */
const initializeConnector = (connector) => {
  if(!Object.keys(disciplCoreConnectors).contains(connector)) {
    disciplCoreConnectors[connector] = require(CONNECTOR_MODULE_PREFIX+connector)
    disciplCoreConnectors[connector].setDisciplAPI(this)
  }
}

/**
 * returns the connector object of the given discipl connector. Automaticly lazy loads the corresponding module
 */
const getConnector = (connector) => {
  initializeConnector(connector)
  return disciplconnectors[connector]
}

/**
 * extracts connector name and reference from a link string and returns it as a json object in the form of: {connector, reference}
 */
const splitLink = (link) => {
  let splitted = link.split(DID_DELIMITER)
  let connector = splitted[2]
  let reference = splitted[3]
  return {'connector':connector, 'reference':reference}
}

/**
 * returns a link string for the gieven claim in the channel of the given ssid
 */
const getLink = (ssid, claim) => {
  let connector = ssid.connector.getName()
  if(typeof claim === 'string') {
    return LINK_PREFIX+connector+DID_DELIMITER+claim
  } else {
    return LINK_PREFIX+connector+DID_DELIMITER+getHash(ssid, claim);
  }
}

/**
 * checks if a given string seems to be a valid link (correct syntax and refers to an available connector). Does not check the claim the link refers to exists or not. The reference is not checked
 */
const isValidLink = (link) => {
  try {
    let {connector, reference} = splitLink(link)
    getConnector(connector)
    return true
  } catch(e) {
    return false
  }
}

/**
 * Retrieves an Ssid object for the claim referenced in the given link. Note that the Ssid object will not contain the private key for obvious reasons
 */
const getSsidOfLinkedClaim = async (link) => {
  let {connector, reference} = splitLink(link)
  let conn = getConnector(connector)
  return await conn.getSsidOfClaim(reference)
}

/**
 * returns a HMAC-384 peppered hash of the given data with the did of the given ssid as key
 */
const getHash = (ssid, data) => {
  return CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(data, ssid.did))
}

/**
 * Generates a new ssid, a json object in the form of: {connector:connectorObj, did:did, pubkey:pubkey, privkey:privkey}, for the platform the given discipl connector name adds support for
 */
const newSsid = async (connector) => {
  let conn = getConnector(connector)
  let ssid = await conn.newSsid()
  ssid['connector'] = conn
  ssid['did'] = DID_PREFIX+conn.getName()+DID_DELIMITER+ssid.pubkey
  return ssid
}

/**
 * Adds a claim to the (end of the) channel of the given claim.
 */
const claim = async (ssid, data) => {
  return ssid.connector.claim(ssid, data)
}

/**
 * Adds an attestation claim of the claim the given link refers to using the given predicate in the channel of the given ssid
 */
const attest = async (ssid, predicate, link) => {
  return claim(ssid, {predicate:link})
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
  for(ssid in ssids) {
    let reference = await ssid.connector.verify(ssid, {predicate:link})
    if(reference) {
      if(verify(REVOKE_PREDICATE, getLink(ssid, reference), [ssid]) == null) {
        if(verify(REVOKE_PREDICATE, link, [getSsidOfLinkedClaim(link)]) == null) {
          if(all) {
            result.push(ssid)
          }
          else {
            return ssid
          }
        }
      }
    }
  }
  if(result.count == 0)
    return null;
  return result;
}

/**
 * Retrieves the data of the claim a given link refers to along with a link to the previous claim in the same channel.
 * @param {string} link - link to the claim of which the data should be retreved
 * @param {json} ssid - Optional : the ssid of the actor (on the same platform as the claim the links refers to) that wants to get the data but may not have permission without identifying itself
 * @return {json} - {data, linkToPrevious}
 */
const get = async (link, ssid = null) => {
  let {connector, reference}  = splitLink(link)
  let conn = getConnector(connector)
  let {data, previous} = await conn.get(reference, ssid)
  let prevlink = LINK_PREFIX+conn.getName()+DID_DELIMITER+previous
  return {data, prevlink}
}

/**
 * Subscribes a given callback function to be called when new claims are found in a given channel. Note that it will start at the end of the channel; previous claims that has already been added in the channel are ignored.
 * @param {json} ssid - The ssid json object containing did as public key : {pubkey:did, privkey:pkey}. This should be the ssid of the channel to subscribe to
 */
const subscribe = async (ssid) => {
  return ssid.connector.subscribe(ssid)
}

/**
 * Exports linked claim data starting with the claim the given link refers to.
 * Links contained in the data of the claim are exported also in a value alongside of the link and links in data of those claims are processed in a same way too etc.
 * By default, expansion like this is done at most three times. You can alter this depth of the export by setting the second argument. If the maximum depth is reached the exported data
 * will contain the value MAX_DEPTH_REACHED alongside of the link instead of an exported dataset. You can use this method to iteratively expand the dataset using the link that was not followed.
 * A claim is never exported twice; circulair references are not followed.
 */
const exportLD = async (link, depth = 3, ssid = null, visitedStack = []) => {
  let exportData = []
  let previous = link
  while(previous) {
    let data = null
    try {
      let {d, p} = await get(previous, ssid)
      data = d
      previous = p
    } catch(err) {
      data = {previous, err};
      previous = null;
    }
    for(elem in data) {
      if(isValidLink(elem)) {
        if(depth && !visitedStack.contains(elem)) {
          depth--;
          visitedStack.push(elem)
          let ld = await exportLD(elem, depth, ssid, visitedStack)
          elem = {elem, ld}
          visitedStack.pop()
          depth++;
        } else {
          elem = {elem, MAX_DEPTH_REACHED}
        }
      }
    }
    exportData.push(data)
  }
  return exportData
}

/**
 * Adds a revocation attestation to the channel of the given ssid. Effectively revokes the claim the given link refers to. Subsequent verification of the claim will not succeed.
 * @param {json} ssid - The ssid json object. The attestation is added to the channel of this ssid
 * @param {string} link - The link to the claim (or attestation) that should be attested as being revoked. Note that this claim must be in the channel of the given ssid to be effectively seen as revoked.
 */
const revoke = async (ssid, link) => {
  return attest(ssid, REVOKE_PREDICATE, link)
}

module.exports = {
  getConnector,
  newSsid,
  claim,
  attest,
  verify,
  get,
  exportLD,
  revoke,
  subscribe,
  MAX_DEPTH_REACHED
}
