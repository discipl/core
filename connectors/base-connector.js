module.exports = class BaseConnector {

  constructor() {

  }

  initState(initData) {
    throw new Error("BaseConnector is not meant for direct usage.")
  }
  
  serialize(state) {
  }

  deserialize(state) {
  }

  getDid(state) {

  }

  async claim(state, data) {

  }

  async getByReference(ref) {

  }

  async findRefInChannel(did, ref) {

  }

  attest(state, data, hashKey) {

  }

  async verify(state, data, hashKey, attestorDid) {

  }

}
