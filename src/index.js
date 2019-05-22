import { loadConnector } from './connector-loader'
import { Observable } from 'rxjs'
import { concat, filter } from 'rxjs/operators'
import { BaseConnector } from '@discipl/core-baseconnector'
import ObserveResult from './observe-result'

const MAX_DEPTH_REACHED = 'MAX_DEPTH_REACHED'
const REVOKE_PREDICATE = 'revoke'

/**
 * @module discipl-core
 */

class DisciplCore {
  constructor () {
    this.disciplCoreConnectors = []
  }

  /**
   * Requires and holds in memory the given discipl connector (if not done before)
   *
   * @param {string} connectorName
   * @returns {Promise<void>}
   */
  async initializeConnector (connectorName) {
    if (!Object.keys(this.disciplCoreConnectors).includes(connectorName)) {
      let ConnectorModuleClass = await loadConnector(connectorName)
      this.registerConnector(connectorName, new ConnectorModuleClass())
    }
  }

  /**
   * Returns the connector object of the given discipl connector. Automaticly lazy loads the corresponding module
   *
   * @param {string} connectorName
   * @returns {Promise<*>} The connector (needs to extend {@link BaseConnector})
   */
  async getConnector (connectorName) {
    await this.initializeConnector(connectorName)
    return this.disciplCoreConnectors[connectorName]
  }

  /**
   * Registers a connector explicitly.
   *
   * @param {string} name - Name of the connector
   * @param {object} connector - Instantiated object representing the connector
   */
  registerConnector (name, connector) {
    this.disciplCoreConnectors[name] = connector
  }

  /**
   * Retrieves the did that made the claim referenced in the given link
   *
   * @param {string} link
   * @returns {Promise<string>} did
   */
  async getDidOfLinkedClaim (link) {
    let connectorName = BaseConnector.getConnectorName(link)
    let conn = await this.getConnector(connectorName)
    return conn.getDidOfClaim(link)
  }

  /**
   * Generates a new ssid using the specified connector
   *
   * @param {string} connectorName - Name of the connector used
   * @returns {Promise<{privkey: string, did: string}>}
   */
  async newSsid (connectorName) {
    let conn = await this.getConnector(connectorName)
    return conn.newIdentity()
  }

  /**
   * Adds a claim to the (end of the) channel of the given ssid. Returns a link to this claim.
   *
   * @param {object} ssid
   * @param {string} ssid.did - Did that makes the claim
   * @param {string} ssid.privkey - Private key to sign the claim
   * @param {object} data - Data to be claimed
   * @returns {Promise<string>}
   */
  async claim (ssid, data) {
    let connectorName = BaseConnector.getConnectorName(ssid.did)
    let connector = await this.getConnector(connectorName)
    return connector.claim(ssid.did, ssid.privkey, data)
  }

  /**
   * Adds an attestation claim of the claim the given link refers to using the given predicate in the channel of the given ssid
   *
   * @param {object} ssid
   * @param {string} ssid.did - Did that makes the attestation
   * @param {string} ssid.privkey - Private key to sign the attestation
   * @param {string} predicate - Statement being made about the claim linked
   * @param {string} link - Object of the attestation
   * @returns {Promise<string>} Link to the attestation
   */
  async attest (ssid, predicate, link) {
    let attest = {}
    attest[predicate] = link
    return this.claim(ssid, attest)
  }

  async allow (ssid, scope = null, did = null) {
    const allowConfiguration = {}
    if (scope != null) {
      allowConfiguration['scope'] = scope
    }

    if (did != null) {
      allowConfiguration['did'] = did
    }

    await this.claim(ssid, { [BaseConnector.ALLOW]: allowConfiguration })
  }

  /**
   * Will verify existence of an attestation of the claim referenced in the given link and mentioning the given predicate.
   * If the referenced claim or an attestation itself are revoked, the method will not evaluate the claim as having been attested.
   *
   * @param {string} predicate
   * @param {string} link
   * @param {string[]} dids
   * @param {object} verifierSsid - ssid object that grants access to the relevant claims
   * @returns {Promise<string>} The first did that attested, null if none have.
   */
  async verify (predicate, link, dids, verifierSsid = { 'did': null, 'privkey': null }) {
    for (let did of dids) {
      if (typeof did !== 'string') {
        continue
      }
      let connectorName = BaseConnector.getConnectorName(did)
      let connector = await this.getConnector(connectorName)
      let attestation = {}

      attestation[predicate] = link
      let attestationLink = await connector.verify(did, attestation, verifierSsid.did, verifierSsid.privkey)
      if (attestationLink) {
        if (await this.verify(REVOKE_PREDICATE, attestationLink, [did]) == null) {
          if (predicate === REVOKE_PREDICATE || await this.verify(REVOKE_PREDICATE, link, [await this.getDidOfLinkedClaim(link)]) == null) {
            return did
          }
        }
      }
    }

    return null
  }

  /**
   * Retrieves the data of the claim a given link refers to along with a link to the previous claim in the same channel.
   *
   * @param {string} link - link to the claim of which the data should be retrieved
   * @param {object} ssid - Optional: Authorizaiton method if the claim in question is not publically visible
   * @param {string} ssid.did - Did that makes the request
   * @param {string} ssid.privkey - Private key to sign the request
   * @return {Promise<{data: object, previous: string}>}
   */
  async get (link, ssid = null) {
    let connectorName = BaseConnector.getConnectorName(link)
    let conn = await this.getConnector(connectorName)
    if (ssid != null) {
      return conn.get(link, ssid.did, ssid.privkey)
    }
    return conn.get(link)
  }

  /**
   * Returns an Observable with claims
   *
   * @param {string} did - Did to filter claims
   * @param {object} claimFilter - filters by the content of claims
   * @param {boolean} historical - if true, the result will start at the beginning of the channel
   * @param {object} connector - needs to be provided in order to listen platform-wide without ssid
   * @param {object} observerSsid - Ssid to allow access to claims
   * @returns {ObserveResult}
   */
  async observe (did, observerSsid = { 'did': null, 'privkey': null }, claimFilter = {}, historical = false, connector = null) {
    if (connector != null && did == null) {
      let observeAllResult = await this.observeAll(connector, claimFilter, observerSsid)
      return new ObserveResult(observeAllResult.observable, observeAllResult.readyPromise)
    }
    if (did == null) {
      throw Error('Observe without did or connector is not supported')
    }

    let connectorName = BaseConnector.getConnectorName(did)
    connector = await this.getConnector(connectorName)
    let currentObservableResult = await connector.observe(did, claimFilter, observerSsid.did, observerSsid.privkey)

    if (!historical) {
      return new ObserveResult(currentObservableResult.observable, currentObservableResult.readyPromise)
    }

    let historyObservable = Observable.create(async (observer) => {
      let latestClaim = await connector.getLatestClaim(did)

      let claims = []

      let current = await this.get(latestClaim, observerSsid)
      while (current != null) {
        claims.unshift({ 'claim': current, 'did': did })

        if (current.previous) {
          current = await this.get(current.previous, observerSsid)
        } else {
          current = null
        }
      }

      for (let claim of claims) {
        observer.next(claim)
      }
    }).pipe(filter(claim => {
      if (claimFilter != null) {
        for (let predicate of Object.keys(claimFilter)) {
          if (claim['claim']['data'][predicate] == null) {
            // Predicate not present in claim
            return false
          }

          if (claimFilter[predicate] != null && claimFilter[predicate] !== claim['claim']['data'][predicate]) {
            // Object is provided in filter, but does not match with actual claim
            return false
          }
        }
      }
      return true
    }))

    return new ObserveResult(historyObservable.pipe(concat(currentObservableResult.observable)), currentObservableResult.readyPromise)
  }

  async observeAll (connector, claimFilter, observerSsid) {
    return connector.observe(null, claimFilter, observerSsid.did, observerSsid.privkey)
  }

  /**
   * Exports linked claim data starting with the claim the given link refers to.
   * Links contained in the data of the claim are exported also in a value alongside of the link and links in data of those claims are processed in a same way too etc.
   * By default, expansion like this is done at most three times. You can alter this depth of the export by setting the second argument. If the maximum depth is reached the exported data
   * will contain the value MAX_DEPTH_REACHED alongside of the link instead of an exported dataset. You can use this method to iteratively expand the dataset using the link that was not followed.
   * A claim is never exported twice; circulair references are not followed.
   */
  async exportLD (didOrLink, exporterSsid = { 'did': null, 'privkey': null }, maxdepth = 3, ssid = null, visitedStack = [], withPrevious = false) {
    let isDidBool = BaseConnector.isDid(didOrLink)
    let isLinkBool = BaseConnector.isLink(didOrLink)
    if (!isDidBool && !isLinkBool) {
      return didOrLink
    }

    let connectorName = BaseConnector.getConnectorName(didOrLink)
    let connector = await this.getConnector(connectorName)

    let currentDid = isDidBool ? didOrLink : await connector.getDidOfClaim(didOrLink)
    let currentLink = isLinkBool ? didOrLink : await connector.getLatestClaim(didOrLink)

    if (isDidBool) {
      withPrevious = true
    }

    if (visitedStack.length >= maxdepth) {
      return { didOrLink: MAX_DEPTH_REACHED }
    } else if (!withPrevious) {
      visitedStack.push(currentLink)
    }

    let channelData = []

    let res = await this.get(currentLink, exporterSsid)
    if (res != null) {
      let data = res.data

      if (res.previous && withPrevious) {
        let prevData = await this.exportLD(res.previous, exporterSsid, maxdepth, currentDid, visitedStack, true)
        channelData = prevData[currentDid]
      }

      let linkData = {}
      if (Array.isArray(data)) {
        linkData = []
      }

      for (let elem in data) {
        if (data.hasOwnProperty(elem)) {
          let value = data[elem]
          let exportValue = await this.exportLD(value, exporterSsid, maxdepth, ssid, visitedStack, false)

          if (Array.isArray(data)) {
            linkData.push(exportValue)
          } else {
            linkData[elem] = exportValue
          }
        }
      }

      channelData.push({ [currentLink]: linkData })
    }

    return { [currentDid]: channelData }
  }

  /**
   * Imports claims given a dataset as returned by exportLD. Claims linked in the claims are not imported (so max depth = 1)
   * Not all connectors will support this method and its functioning may be platform specific. Some may actually let you
   * create claims in bulk through this import. Others will only check for existence and validate.
   */
  async importLD (data, importerDid = null) {
    let succeeded = null
    for (let did in data) {
      if (!BaseConnector.isDid(did)) {
        continue
      }

      for (let i in data[did]) {
        let link = Object.keys(data[did][i])[0]
        let claim = data[did][i][link]
        let predicate = Object.keys(claim)[0]

        let res = await this.importLD(claim[predicate], importerDid)
        if (res != null) {
          let nestedDid = Object.keys(claim[predicate])[0]
          let l = Object.keys(claim[predicate][nestedDid][0])[0]
          claim = { [predicate]: l }
        }

        let connectorName = BaseConnector.getConnectorName(did)
        let connector = await this.getConnector(connectorName)

        let result = await connector.import(did, link, claim, importerDid)
        if (result == null) {
          return null
        } else {
          succeeded = true
        }
      }
    }
    return succeeded
  }

  /**
   * Adds a revocation attestation to the channel of the given ssid. Effectively revokes the claim the given link refers to. Subsequent verification of the claim will not succeed.
   * @param {json} ssid - The ssid json object. The attestation is added to the channel of this ssid
   * @param {string} link - The link to the claim (or attestation) that should be attested as being revoked. Note that this claim must be in the channel of the given ssid to be effectively seen as revoked.
   */
  async revoke (ssid, link) {
    return this.attest(ssid, REVOKE_PREDICATE, link)
  }
}

export {
  DisciplCore,
  ObserveResult
}
