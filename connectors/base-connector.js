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

  async exportLD(did) {
  
  }
  
  async findRefInChannel(did, ref) {

  }

  attestHash(data, hashKey) {
  
  }

  attest(state, data, hashKey) {

  }
  
  attestByReference(mamState, ref) {
	  
  }
  
  async verifyByRef(ref, attestorDid) {
	  
  }

  async verify(state, data, hashKey, attestorDid) {

  }
  
  

}
