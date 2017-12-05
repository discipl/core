const connectors = {
  iota: require('./connectors/iota.js'),
  local: require('./connectors/local.js')
}
Object.freeze(connectors)

const serialize = (conn, state) => {
  return conn.serialize(state)
}

const deserialize = (conn, state) => {
  return conn.deserialize(state)
}

const initState = (conn, initData) => {
  return conn.initState(initData)
}

const getDid = (conn, state) => {
  return conn.getDid(state)
}

const claim = async (conn, state, data) => {
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
  serialize,
  deserialize,
  initState,
  getDid,
  claim,
  attest,
  verify,
  getByReference,
  connectors: connectors
}
