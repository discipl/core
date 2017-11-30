const connectors = {
  iota: require('./connectors/iota.js')
}
Object.freeze(connectors)

const getDid = (conn, state) => {
  return conn.getDid(state)
}

const claim = async (state, data) => {
  return conn.claim(state, data)
}

const attest = async (conn, state, data, hashKey) => {
  return conn.attest(state, data, hashKey)
}

const verify = async (conn, state, data, hashKey, attestorDid) => {
  return conn.verify(state, data, hashKey, attestorDid)
}

const getByReference = async (conn, ref) => {
  return conn.getByReference(ref)
}

const findRefInChannel = async (conn, did, ref) => {
  return conn.findRefInChannel(did, ref)
}

module.exports = {
  getDid,
  claim,
  attest,
  verify,
  getByReference,
  connectors: connectors
}
