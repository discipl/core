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

  newSsid() {
    return {'pubkey':null, 'privkey':null}
  }

  async claim(ssid, data) {
    return false;
  }

  get(ssid, reference) {
    return {'data':'', 'previous':null}
  }

  /**
   * Verifies existence of a claim with the given data in the channel of the given ssid
   */
  verify(ssid, data) {
    let current = null
    let {d, p} = get(ssid, null)
    while((p != null) && (JSON.stringify(data) != JSON.stringify(d))) {
      current = p
      let {dp, pp} = get(ssid, p)
      d = dp
      p = pp
    }
    return current
  }

  subscribe(ssid) {
    return false;
  }

}
