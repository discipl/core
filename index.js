
const CryptoJS = require('crypto-js')

const DID_DELIMITER = ':'
const MAX_DEPTH_REACHED = 'MAX_DEPTH_REACHED'
const LINK_PREFIX = 'link'+DID_DELIMITER+'discipl'+DID_DELIMITER
const DID_PREFIX = 'did'+DID_DELIMITER+'discipl'+DID_DELIMITER
const REVOKE_PREDICATE = 'revoke'
const CONNECTOR_MODULE_PREFIX = 'discipl-core-'

const disciplCoreConnectors = []

const initializeConnector = (connector) => {
  if(!Object.keys(disciplCoreConnectors).contains(connector)) {
    disciplCoreConnectors[connector] = require(CONNECTOR_MODULE_PREFIX+connector)
  }
}

const getConnector = (connector) {
  initializeConnector(connector)
  return disciplconnectors[connector]
}

const splitSsid = (ssid) {
  const splitted = Object.keys(ssid)[0].split(DID_DELIMITER)
  return {splitted[2], splitted[3], ssid[0]}
}

const splitLink = (link) {
  const splitted = link.split(DID_DELIMITER)
  return {splitted[2], splitted[3]}
}

const getLink = (ssid, claim) => {
  connector = getConnectorNameFromSsid(ssid)
  if(typeof claim === 'string') {
    return LINK_PREFIX+connector+DID_DELIMITER+claim
  } else {
    return LINK_PREFIX+connector+DID_DELIMITER+getHash(ssid, claim);
  }
}

const isValidLink = (link) {
  try {
    {connector, reference} = splitLink(link)
    conn = getConnector(connector)
  } catch(e) {
    return false
  }
}

const getChannel = (ssid) {
  {connector, pubkey, privkey} = splitSsid(ssid)
  return {getConnector(connector), {pubkey:privkey}}
}

const getSsidOfLinkedClaim = (link) {
  {connector, reference} = splitLink(link)
  conn = getConnector(connector)
  return conn.getSsidOfClaim(reference)
}

const getHash = (ssid, data) {
  return CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA384(data, Object.keys(ssid)[0]))
}

const newSsid = (connector) => {
  {conn,ssid} = getChannel({DID_PREFIX+connector+DID_DELIMITER:''})
  {pubkey, privkey} = conn.newSsid()
  return {DID_PREFIX+conn.getName()+DID_DELIMITER+pubkey:privkey}
}

const claim = (ssid, data, callback) => {
  {conn,ssid} = getChannel(ssid)
  return conn.claim(ssid, data, callback)
}

const attest = (ssid, predicate, link, callback) => {
  return claim(ssid, {predicate:link}, callback)
}

const getLatestClaimInChannel = (ssid) => {
  {conn,ssid} = getChannel(ssid)
  return conn.getLatestClaimInChannel(ssid)
}

const findClaim(ssid, data) {
  var d = ''
  var p = ''
  var current
  while((p != null) && (JSON.stringify(data) != JSON.stringify(d))) {
    current = p
    {d, p} = getLatestClaimInChannel(ssid)
  }
  return current
}

const findAttestation(ssid, predicate, link) {
  return findClaim(ssid, {predicate:link})
}

const verify = (predicate, link, ssids) => {
  const result = []
  for(ssid in ssids) {
    reference = findAttestation(ssid, predicate, link);
    if(reference) {
      if(verify(REVOKE_PREDICATE, getLink(ssid, reference), [ssid]) == null) {
        if(verify(REVOKE_PREDICATE, link, [getSsidOfLinkedClaim(link)]) == null) {
          result[] = ssid;
        }
      }
    }
  }
  if(result.count == 0)
    return null;
  return result;
}

const get = (link, ssid = null) => {
  const conn = null;
  {connector, reference}  = splitLink(link)
  if(ssid) {
    {conn, ssid} = getChannel(ssid)
  } else {
    conn = getConnector(connector)
  }
  {data, previous} = conn.get(reference, ssid)
  return {data, LINK_PREFIX+conn.getName()+DID_DELIMITER+previous}
}

const subscribe(ssid, callback) {
  {conn, ssid} = getChannel(ssid)
  return conn.subscribe(ssid, callback)
}

const exportLD = (link, depth, ssid = null) => {
  const exportData = {}
  const previous = link
  while(previous) {
    try {
      {data, prev} = get(previous, ssid)
      previous = prev
    } catch(err) {
      data = {previous, err};
      previous = null;
    }
    for(elem in data) {
      if(isValidLink(elem)) {
        if(depth) {
          depth--;
          elem = exportLD(elem, depth, ssid)
          depth++;
        } else {
          elem = {elem, MAX_DEPTH_REACHED}
        }
      }
    }
    exportData[] = data
  }
}

const revoke = (ssid, link, callback) => {
  return attest(ssid, REVOKE_PREDICATE, link, callback)
}

module.exports = {
  newSsid,
  claim,
  attest,
  verify,
  get,
  exportLD,
  revoke,
  MAX_DEPTH_REACHED
}
