module.exports = class BaseConnector {

  constructor() {
    this.discipl = null
  }

  setDisciplAPI(api) {
    this.discipl = api
  }

  getName() {
    return "base"
  }

  getSsidOfClaim(reference) {
    return null
  }

  async getLatestClaim(ssid) {
    return null
  }

  async newSsid() {
    return {'pubkey':null, 'privkey':null}
  }

  async claim(ssid, data) {
    return false;
  }

  async get(reference, ssid = null) {
    return {'data':'', 'previous':null}
  }

  /**
   * Verifies existence of a claim with the given data in the channel of the given ssid
   */
  async verify(ssid, data) {
    let current = await this.getLatestClaim(ssid)
    while(current != null) {
      let res = await this.get(current, ssid)
      if((res != null) && (JSON.stringify(data) == JSON.stringify(res.data))) {
        return current
      }
      current = res.previous
    }
    return current
  }

  async subscribe(ssid) {
    return false;
  }

}
