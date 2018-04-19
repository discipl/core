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
  return await conn.claim(state, data)
}

const attest = async (conn, state, data, hashKey) => {
  return conn.attest(state, data, hashKey)
}

const attestByReference = (conn, mamState, ref) => {
  return conn.attestByReference(mamState, ref)
}

const verify = async (conn, ref, attestorDid, data, hashKey) => {
  return await conn.verify(ref, attestorDid, data, hashKey)
}

const getByReference = async (conn, ref) => {
  return await conn.getByReference(ref)
}

const exportLD = async (conn, did) => {
  return await conn.exportLD(did)
}

const findRefInChannel = async (conn, did, ref) => {
  return await conn.findRefInChannel(did, ref)
}

module.exports = {
  serialize,
  deserialize,
  initState,
  getDid,
  claim,
  attest,
  attestByReference,
  verify,
  getByReference,
  exportLD,
  connectors: connectors
}
