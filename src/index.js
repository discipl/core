import { loadConnector } from './connector-loader'
import { Observable } from 'rxjs'
import { concat, filter } from 'rxjs/operators'
import { BaseConnector } from '@discipl/core-baseconnector'
import ObserveResult from './observe-result'
import { version } from '../package.json'

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
   * @typedef {Object} ssid - Identifier of an actor
   * @property {string} ssid.did - Did of the actor
   * @property {string} ssid.privkey - Private key belonging to the did
   */

  /**
   * Requires and holds in memory the given discipl connector (if not done before)
   *
   * @param {string} connectorName
   * @returns {Promise<void>}
   */
  async initializeConnector (connectorName) {
    if (!Object.keys(this.disciplCoreConnectors).includes(connectorName)) {
      const ConnectorModuleClass = await loadConnector(connectorName)
      this.registerConnector(connectorName, new ConnectorModuleClass())
    }
  }

  /**
   * returns the version of this core package
   */
  getVersion () {
    return version
  }

  /**
   * Returns a instance of the given discipl connector and automatically lazy loads the corresponding module
   *
   * @param {string} connectorName Name of the connector to load
   * @returns {Promise<*>} Connector instance that extends from {@link BaseConnector}
   */
  async getConnector (connectorName) {
    await this.initializeConnector(connectorName)
    return this.disciplCoreConnectors[connectorName]
  }

  /**
   * Extracts the connector name from a link or did and return a instance of the connector
   *
   * @param {string} linkOrDid String from which the connector needs to be extracted
   * @returns {Promise<*>} Connector instance that extends from {@link BaseConnector}
   */
  async getConnectorForLinkOrDid (linkOrDid) {
    const connectorName = BaseConnector.getConnectorName(linkOrDid)
    return this.getConnector(connectorName)
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
   * @returns {Promise<string>} Did that made the claim
   */
  async getDidOfLinkedClaim (link) {
    const conn = await this.getConnectorForLinkOrDid(link)
    return conn.getDidOfClaim(link)
  }

  /**
   * Generates a new ssid using the specified connector
   *
   * @param {string} connectorName - Name of the connector used
   * @returns {Promise<ssid>} Created ssid
   */
  async newSsid (connectorName) {
    const conn = await this.getConnector(connectorName)
    return conn.newIdentity()
  }

  /**
   * Adds a claim to the (end of the) channel of the given ssid.
   *
   * @param {ssid} ssid
   * @param {object} data - Data to be claimed
   * @param {object} attester - Ssid of the attester, used for access management
   * @returns {Promise<string>} Link to the made claim
   */
  async claim (ssid, data, attester = null) {
    const connector = await this.getConnectorForLinkOrDid(ssid.did)

    if (attester) {
      return connector.claim(ssid.did, ssid.privkey, data, attester.did)
    }

    return connector.claim(ssid.did, ssid.privkey, data)
  }

  /**
   * Adds an attestation claim for a given link. The link will be be added to the channel of the given
   * ssid referenced by the given predicate
   *
   * @param {ssid} ssid
   * @param {string} predicate - Statement being made about the claim linked
   * @param {string} link - Object of the attestation
   * @returns {Promise<string>} Link to the made attestation
   */
  async attest (ssid, predicate, link) {
    const attest = {}
    attest[predicate] = link
    return this.claim(ssid, attest)
  }

  /**
   * Adds a claim to the (end of the) chanel of the given ssid with a specified scope and/or did
   *
   * @param {ssid} ssid
   * @param {string} scope - Scope of this claim. If not present, the scope is the whole channel
   * @param {string} did - Did that is allowed access. If not present, everyone is allowed.
   */
  async allow (ssid, scope = null, did = null) {
    const allowConfiguration = {}
    if (scope != null) {
      allowConfiguration.scope = scope
    }

    if (did != null) {
      allowConfiguration.did = did
    }

    await this.claim(ssid, { [BaseConnector.ALLOW]: allowConfiguration })
  }

  /**
   * Will verify existence of an attestation of the claim referenced in the given link and mentioning the given predicate.
   * If the referenced claim or an attestation itself are revoked, the claim will be treated as "not attested" and thus the
   * method will return null
   *
   * @param {string} predicate - Attestation predicate
   * @param {string} link - Link to the claim to verify attestation for
   * @param {string[]} dids - Candidates that might attested the claim
   * @param {ssid} verifierSsid - Ssid object that grants access to the relevant claims
   * @returns {Promise<string>} The first did that attested, null if none have
   */
  async verify (predicate, link, dids, verifierSsid = { did: null, privkey: null }) {
    for (const did of dids) {
      if (typeof did !== 'string') {
        continue
      }
      const connector = await this.getConnectorForLinkOrDid(did)
      const attestation = { [predicate]: link }
      const attestationLink = await connector.verify(did, attestation, verifierSsid.did, verifierSsid.privkey)

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
   * Retrieves the data of the claim a given link refers to, along with a link to the previous claim in the same channel
   *
   * @param {string} link - link to the claim of which the data should be retrieved
   * @param {ssid} [ssid] - Optional authorization method if the claim in question is not publically visible
   * @return {Promise<{data: object, previous: string}>} Claim data
   */
  async get (link, ssid = null) {
    const conn = await this.getConnectorForLinkOrDid(link)

    if (ssid != null) {
      return conn.get(link, ssid.did, ssid.privkey)
    }

    return conn.get(link)
  }

  /**
   * Observe for new claims that will be made by a specified did
   *
   * @param {string} did - Filter for claims made by a did
   * @param {ssid} observerSsid - Ssid to allow access to claims
   * @param {object} claimFilter - Filters by the content of claims
   * @param {boolean} historical - DEPRECATED if true, the result will start at the beginning of the channel
   * @param {object} connector - Needs to be provided in order to listen platform-wide without ssid
   * @returns {ObserveResult}
   */
  async observe (did, observerSsid = { did: null, privkey: null }, claimFilter = {}, historical = false, connector = null) {
    if (historical) {
      console.warn('Historical observation is deprecated and may be buggy')
    }
    if (connector != null && did == null) {
      const observeAllResult = await this.observeAll(connector, claimFilter, observerSsid)
      return new ObserveResult(observeAllResult.observable, observeAllResult.readyPromise)
    }
    if (did == null) {
      throw Error('Observe without did or connector is not supported')
    }

    connector = await this.getConnectorForLinkOrDid(did)
    const currentObservableResult = await connector.observe(did, claimFilter, observerSsid.did, observerSsid.privkey)

    if (!historical) {
      return new ObserveResult(currentObservableResult.observable, currentObservableResult.readyPromise)
    }

    const historyObservable = Observable.create(async (observer) => {
      const latestClaim = await connector.getLatestClaim(did)
      const claims = []

      let current = await this.get(latestClaim, observerSsid)
      while (current != null) {
        claims.unshift({ claim: current, did: did })

        if (current.previous) {
          current = await this.get(current.previous, observerSsid)
        } else {
          current = null
        }
      }

      for (const claim of claims) {
        observer.next(claim)
      }
    }).pipe(filter(claim => {
      if (claimFilter != null) {
        for (const predicate of Object.keys(claimFilter)) {
          if (claim.claim.data[predicate] == null) {
            // Predicate not present in claim
            return false
          }

          if (claimFilter[predicate] != null && claimFilter[predicate] !== claim.claim.data[predicate]) {
            // Object is provided in filter, but does not match with actual claim
            return false
          }
        }
      }
      return true
    }))

    return new ObserveResult(historyObservable.pipe(concat(currentObservableResult.observable)), currentObservableResult.readyPromise)
  }

  /**
   * Observe for new claims that will be made by anyone
   *
   * @param {object} connector - needs to be provided in order to listen platform-wide without ssid
   * @param {object} claimFilter - Filters by the content of claims
   * @param {ssid} observerSsid - Ssid to allow access to claims
   * @returns {ObserveResult}
   */
  async observeAll (connector, claimFilter, observerSsid) {
    return connector.observe(null, claimFilter, observerSsid.did, observerSsid.privkey)
  }

  /**
   * Observe for verification requests for a given did.
   *
   * @param {object} did - Did to observe verification requests for
   * @param {object} claimFilter
   * @param {string} claimFilter.did - Filter incomming verification requests on did
   * @param {object} observerSsid - The ssid that is observing, used for access management
   * @returns {ObserveResult}
   */
  async observeVerificationRequests (did, claimFilter = null, observerSsid = { did: null, privkey: null }) {
    const connector = await this.getConnectorForLinkOrDid(did)

    if (typeof connector.observeVerificationRequests !== 'function') {
      throw new Error("The 'observeVerificationRequests' method is not supported for the '" + connector.getName() + "' connector")
    }

    const currentObservableResult = await connector.observeVerificationRequests(did, claimFilter, observerSsid.did, observerSsid.privkey)

    return new ObserveResult(currentObservableResult.observable, currentObservableResult.readyPromise)
  }

  /**
   * Exports linked claim data starting with the claim the given link refers to.
   * Links contained in the data of the claim are exported also in a value alongside of the link and links in data of those claims are processed in a same way too etc.
   * By default, expansion like this is done at most three times. You can alter this depth of the export by setting the second argument. If the maximum depth is reached the exported data
   * will contain the value MAX_DEPTH_REACHED alongside of the link instead of an exported dataset. You can use this method to iteratively expand the dataset using the link that was not followed.
   * A claim is never exported twice; circulair references are not followed.
   */
  async exportLD (didOrLink, exporterSsid = { did: null, privkey: null }, maxdepth = 3, ssid = null, visitedStack = [], withPrevious = false) {
    const isDidBool = BaseConnector.isDid(didOrLink)
    const isLinkBool = BaseConnector.isLink(didOrLink)
    withPrevious = isDidBool ? true : withPrevious

    if (!isDidBool && !isLinkBool) {
      return didOrLink
    }

    const connector = await this.getConnectorForLinkOrDid(didOrLink)
    const currentDid = isDidBool ? didOrLink : await connector.getDidOfClaim(didOrLink)
    const currentLink = isLinkBool ? didOrLink : await connector.getLatestClaim(didOrLink)

    if (visitedStack.length >= maxdepth) {
      return { didOrLink: MAX_DEPTH_REACHED }
    }

    if (!withPrevious) {
      visitedStack.push(currentLink)
    }

    let channelData = []

    const res = await this.get(currentLink, exporterSsid)
    if (res != null) {
      const data = res.data

      if (res.previous && withPrevious) {
        const prevData = await this.exportLD(res.previous, exporterSsid, maxdepth, currentDid, visitedStack, true)
        channelData = prevData[currentDid]
      }

      let linkData = {}
      if (Array.isArray(data)) {
        linkData = []
      }

      for (const elem in data) {
        if (data.hasOwnProperty(elem)) {
          const value = data[elem]
          const exportValue = await this.exportLD(value, exporterSsid, maxdepth, ssid, visitedStack, false)

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
   * Exports linked claim data as a W3C Verifiable Presentation starting with the claim the given link refers to.
   * Links contained in the data of the claim are exported also in a value alongside of the link and links in data of those claims are processed in a same way too etc.
   * By default, expansion like this is done at most three times. You can alter this depth of the export by setting the second argument. If the maximum depth is reached the exported data
   * will contain the value MAX_DEPTH_REACHED alongside of the link instead of an exported dataset. You can use this method to iteratively expand the dataset using the link that was not followed.
   * A claim is never exported twice; circulair references are not followed.
   */
  async exportVP (didOrLink, exporterSsid = { did: null, privkey: null }, maxdepth = 3, ssid = null, visitedStack = [], withPrevious = false) {
    const isDidBool = BaseConnector.isDid(didOrLink)
    const isLinkBool = BaseConnector.isLink(didOrLink)
    withPrevious = isDidBool ? true : withPrevious

    if (!isDidBool && !isLinkBool) {
      return didOrLink
    }

    const connector = await this.getConnectorForLinkOrDid(didOrLink)
    const currentDid = isDidBool ? didOrLink : await connector.getDidOfClaim(didOrLink)
    const currentLink = isLinkBool ? didOrLink : await connector.getLatestClaim(didOrLink)

    if (visitedStack.length >= maxdepth) {
      return { didOrLink: MAX_DEPTH_REACHED }
    }

    if (!withPrevious) {
      visitedStack.push(currentLink)
    }

    let channelData = []
    let currentConnectorName = 'unknown'
    let currentConnectorVersion = 'unknown'
    let createdStamp = new Date().toISOString()

    const res = await this.get(currentLink, exporterSsid)
    if (res != null) {
      const data = res.data

      if (res.previous && withPrevious) {
        channelData = await this.exportVP(res.previous, exporterSsid, maxdepth, currentDid, visitedStack, true)
      }

      let linkData = {}
      if (Array.isArray(data)) {
        linkData = []
      }

      for (const elem in data) {
        if (data.hasOwnProperty(elem)) {
          const value = data[elem]
          const exportValue = await this.exportVP(value, exporterSsid, maxdepth, ssid, visitedStack, false)
          let resultValue = null

          if (BaseConnector.isDid(value) || BaseConnector.isLink(value)) {
            // prepend instead of nest
            channelData.push(exportValue)
            resultValue = value
          } else {
            resultValue = exportValue
          }
          if (Array.isArray(data)) {
            linkData.push(resultValue)
          } else {
            linkData[elem] = resultValue
          }
        }
      }

      if (!(linkData.id)) {
        linkData.id = currentDid
      }
      currentConnectorName = BaseConnector.getConnectorName(currentLink)
      currentConnectorVersion = require('../node_modules/@discipl/core-' + currentConnectorName + '/package.json').version

      if (visitedStack.length < 1 || isDidBool) {
        channelData.push({
          'type': ['verifiableCredential'],
          'id': currentLink,
          'issuer': currentDid,
          'issuanceDate': createdStamp,
          'credentialSubject': [linkData],
          'proof': {
            'type': 'DisciplLink',
            'discipl-software-version-info': { [currentConnectorName]: currentConnectorVersion }
          }
        })
      } else {
        channelData.push(linkData)
      }
    }

    if (visitedStack.length < 1 || isDidBool) {
      return {
        '@context': 'https://www.w3.org/2018/credentials/v1',
        'type': ['VerifiablePresentation'],
        'verifiableCredential': channelData,
        'proof': [{
          'type': 'DisciplLink',
          'discipl-software-version-info': { 'core': this.getVersion() }
        }]
      }
    } else {
      return {
        'type': ['verifiableCredential'],
        'id': currentLink,
        'issuer': currentDid,
        'issuanceDate': createdStamp,
        'credentialSubject': channelData,
        'proof': {
          'type': 'DisciplLink',
          'discipl-software-version-info': { [currentConnectorName]: currentConnectorVersion }
        }
      }
    }
  }

  /**
   * Imports claims given a dataset as returned by exportLD. Claims linked in the claims are not imported (so max depth = 1)
   * Not all connectors will support this method and its functioning may be platform specific. Some may actually let you
   * create claims in bulk through this import. Others will only check for existence and validate.
   *
   * @param {*} data
   * @param {*} importerDid
   * @return {boolean}
   */
  async importLD (data, importerDid = null) {
    let succeeded = null

    for (const did in data) {
      if (!BaseConnector.isDid(did)) {
        continue
      }

      for (const i in data[did]) {
        const link = Object.keys(data[did][i])[0]
        let claim = data[did][i][link]
        const predicate = Object.keys(claim)[0]

        const res = await this.importLD(claim[predicate], importerDid)
        if (res != null) {
          const nestedDid = Object.keys(claim[predicate])[0]
          const l = Object.keys(claim[predicate][nestedDid][0])[0]
          claim = { [predicate]: l }
        }

        const connector = await this.getConnectorForLinkOrDid(did)
        const result = await connector.import(did, link, claim, importerDid)

        if (result == null) {
          return null
        }

        succeeded = true
      }
    }

    return succeeded
  }

  /**
   * Adds a revocation attestation to the channel of the given ssid. Effectively revokes the claim the given link refers to. Subsequent verification of the claim will not succeed.
   *
   * @param {ssid} ssid - The ssid makes the revoke attestation
   * @param {string} link - The link to the claim (or attestation) that should be attested as being revoked. Note that this claim must be in the channel of the given ssid to be effectively seen as revoked.
   * @return {Promise<string>} Link to the attestation
   */
  async revoke (ssid, link) {
    return this.attest(ssid, REVOKE_PREDICATE, link)
  }
}

export {
  DisciplCore,
  ObserveResult
}
