module.exports = class BaseConnector {

  constructor() {
    throw new Error("BaseConnector is not meant for direct usage.")
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
