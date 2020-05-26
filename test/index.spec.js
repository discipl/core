/* eslint-env mocha */
/* eslint prefer-const: "off" */
import { expect, assert } from 'chai'
import { loadConnector } from '../src/connector-loader.js'

import sinon from 'sinon'
import { DisciplCore } from '../src'
import { Subject } from 'rxjs'

let discipl

describe('discipl-core', () => {
  describe('The disciple core API with ephemeral connector', () => {
    before(() => {
      discipl = new DisciplCore()
    })

    it('should be able to get the connector asynchronously', async () => {
      const connector = await discipl.getConnector('ephemeral')
      expect(connector.getName()).to.equal('ephemeral')

      expect(connector.getName(), 'when loaded for the second time').to.equal('ephemeral')
    })

    it('should be able to retrieve a new ssid asynchronously', async () => {
      let ssid = await discipl.newSsid('ephemeral')

      expect(ssid.privkey).to.be.a('Uint8Array')
      expect(ssid.did).to.be.a('string')
      expect(ssid.did.startsWith('did:discipl:ephemeral:')).to.equal(true)
    })

    it('should be able to add a first claim to some new channel through a claim() method', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimlink = await discipl.claim(ssid, { 'need': 'beer' })

      expect(claimlink).to.be.a('string')
    })

    it('should be able to get a claim added through claim, with link to previous', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimlink1 = await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let claim = await discipl.get(claimlink2, ssid)
      expect(JSON.stringify(claim.data)).to.equal(JSON.stringify({ 'need': 'wine' }))
      expect(claim.previous).to.equal(claimlink1)
    })

    it('should be able to attest to a second claim in a chain', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('ephemeral')

      let attestationLink = await discipl.attest(attestorSsid, 'agree', claimlink2)

      let attestation = await discipl.get(attestationLink, attestorSsid)

      expect(attestation.data.agree).to.equal(claimlink2)
      expect(attestation.previous).to.equal(null)
    })

    it('should be able to verify an attestation', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('ephemeral')
      await discipl.allow(attestorSsid)

      await discipl.attest(attestorSsid, 'agree', claimlink2)

      let verifiedAttestor = await discipl.verify('agree', claimlink2, [ssid, ssid.did, null, 'did:discipl:ephemeral:1234', attestorSsid.did], ssid)

      // The first ssid that is valid and proves the attestation should be returned
      expect(verifiedAttestor).to.equal(attestorSsid.did)
    })

    it('should be able to not verify an attestation of a revoked claim', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('ephemeral')

      await discipl.attest(attestorSsid, 'agree', claimlink2)
      await discipl.revoke(ssid, claimlink2)

      let verifiedAttestor = await discipl.verify('agree', claimlink2, [attestorSsid])

      // The first ssid that is valid and proves the attestation should be returned
      // but none such was given so it should not find any matching attestor
      expect(verifiedAttestor).to.equal(null)
    })

    it('be able to observe', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'beer' })
      let observeResult = await discipl.observe(ssid.did, ssid)
      let resultPromise = observeResult.takeOne()
      let claimLink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let result = await resultPromise

      expect(result).to.deep.equal({
        'claim': {
          'data': {
            'need': 'wine'
          },
          'previous': claimLink
        },
        'did': ssid.did,
        'link': claimLink2
      })
    })

    it('be able to observe and subscribe', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'beer' })
      let observeResult = await discipl.observe(ssid.did, ssid)

      return new Promise(async (resolve, reject) => {
        await observeResult.subscribe((result) => {
          expect(result.claim).to.deep.equal({
            'data': {
              'need': 'wine'
            },
            'previous': claimLink
          })

          expect(result.did).to.equal(ssid.did)
          resolve()
        })
        await discipl.claim(ssid, { 'need': 'wine' })
      })
    })

    it('be able to observe platform-wide', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'beer' })
      let observeResult = await discipl.observe(null, ssid, {}, false, await discipl.getConnector('ephemeral'))
      let resultPromise = observeResult.takeOne()
      let claimLink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let result = await resultPromise

      expect(result).to.deep.equal({
        'claim': {
          'data': {
            'need': 'wine'
          },
          'previous': claimLink
        },
        'did': ssid.did,
        'link': claimLink2
      })
    })

    it('be able to observe historically', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'beer' })
      let observeResult = await discipl.observe(ssid.did, ssid, null, true)

      await discipl.claim(ssid, { 'need': 'wine' })

      let resultPromise = observeResult.take(2)

      let result = await resultPromise

      expect(result).to.deep.equal([
        {
          'claim': {
            'data': {
              'need': 'beer'
            },
            'previous': null
          },
          'did': ssid.did
        },
        {
          'claim': {
            'data': {
              'need': 'wine'
            },
            'previous': claimLink
          },
          'did': ssid.did
        }
      ])
    })

    it('be able to observe historically with a filter', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'beer' })
      await discipl.claim(ssid, { 'need': 'wine' })
      await discipl.claim(ssid, { 'need': 'tea' })
      let observeResult = await discipl.observe(ssid.did, ssid, { 'need': 'wine' }, true)

      let resultPromise = observeResult.takeOne()
      let result = await resultPromise

      expect(result).to.deep.equal(
        {
          'claim': {
            'data': {
              'need': 'wine'
            },
            'previous': claimLink
          },
          'did': ssid.did
        }
      )
    })

    it('be able to observe historically with a filter on the predicate', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimLink = await discipl.claim(ssid, { 'need': 'wine' })
      await discipl.claim(ssid, { 'desire': 'wine' })
      await discipl.claim(ssid, { 'need': 'wine' })
      let observeResult = await discipl.observe(ssid.did, ssid, { 'desire': null }, true)

      let result = await observeResult.takeOne()

      expect(result).to.deep.equal(
        {
          'claim': {
            'data': {
              'desire': 'wine'
            },
            'previous': claimLink
          },
          'did': ssid.did
        }
      )
    })

    it('not be able to observe historically without an ssid', async () => {
      try {
        await discipl.observe(null, {}, false)
        expect(false).to.equal(true)
      } catch (e) {
        expect(e).to.be.a('error')
        expect(e.message).to.equal('Observe without did or connector is not supported')
      }
    })

    it('should be able to export linked verifiable claim channels given a did', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      await discipl.allow(ssid)

      let attestorSsid = await discipl.newSsid('ephemeral')

      let attestationLink = await discipl.attest(attestorSsid, 'agree', claimlink2)
      let exportedData = await discipl.exportLD(attestorSsid.did, attestorSsid)

      expect(exportedData[attestorSsid.did][0]).to.deep.equal({ [attestationLink]: { 'agree': { [ssid.did]: [ { [claimlink2]: { 'need': 'wine' } } ] } } })
    })

    it('should be able to export multiple (linked) verifiable claims in a channel in order', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let claimlink1 = await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let ssid2 = await discipl.newSsid('ephemeral')
      await discipl.allow(ssid2)
      let claimlink3 = await discipl.claim(ssid2, { 'need': 'water' })

      let attestationLink = await discipl.attest(ssid, 'agree', claimlink3)
      let exportedData = await discipl.exportLD(ssid.did, ssid)

      expect(exportedData[ssid.did][0]).to.deep.equal({ [claimlink1]: { 'need': 'beer' } })
      expect(exportedData[ssid.did][1]).to.deep.equal({ [claimlink2]: { 'need': 'wine' } })
      expect(exportedData[ssid.did][2]).to.deep.equal({ [attestationLink]: { 'agree': { [ssid2.did]: [ { [claimlink3]: { 'need': 'water' } } ] } } })
    })

    it('should be able to export more complex json objects as data', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      await discipl.allow(ssid)
      let claimlink1 = await discipl.claim(ssid, { 'need': 'wine' })
      let claimlink2 = await discipl.claim(ssid, [{ 'need': 'beer' }, claimlink1])

      let ssid2 = await discipl.newSsid('ephemeral')
      let attestationLink = await discipl.attest(ssid2, 'agree', claimlink2)
      let exportedData = await discipl.exportLD(ssid2.did, ssid2)

      expect(exportedData[ssid2.did][0]).to.deep.equal({ [attestationLink]: { 'agree': { [ssid.did]: [ { [claimlink2]: [{ 'need': 'beer' }, { [ssid.did]: [ { [claimlink1]: { 'need': 'wine' } } ] }] } ] } } })
    })

    it('should be able to import multiple verifiable claims in multiple channels in order (in ephemeral connector)', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let ssid2 = await discipl.newSsid('ephemeral')

      await discipl.claim(ssid, { 'need': 'food' })
      await discipl.claim(ssid, { 'match': 'link' })
      await discipl.claim(ssid, { 'allow': 'some' })
      await discipl.claim(ssid2, { 'require': 'drink' })
      await discipl.claim(ssid2, { 'solved': 'problem' })
      await discipl.claim(ssid2, { 'attendTo': 'wishes' })
      let ld = await discipl.exportLD(ssid.did, ssid)
      let ld2 = await discipl.exportLD(ssid2.did, ssid2)

      // reset ephemeral connector (in memory mode)
      let ConnectorModuleClass = await loadConnector('ephemeral')
      discipl.registerConnector('ephemeral', new ConnectorModuleClass())

      let result = await discipl.importLD({ ...ld, ...ld2 })
      expect(result).to.equal(true)

      let channelData = await discipl.exportLD(ssid.did, ssid)
      expect(channelData[ssid.did][0][Object.keys(channelData[ssid.did][0])]).to.deep.equal({ 'need': 'food' })
      expect(channelData[ssid.did][1][Object.keys(channelData[ssid.did][1])]).to.deep.equal({ 'match': 'link' })
      expect(channelData[ssid.did][2][Object.keys(channelData[ssid.did][2])]).to.deep.equal({ 'allow': 'some' })
      let channelData2 = await discipl.exportLD(ssid2.did, ssid2)
      expect(channelData2[ssid2.did][0][Object.keys(channelData2[ssid2.did][0])]).to.deep.equal({ 'require': 'drink' })
      expect(channelData2[ssid2.did][1][Object.keys(channelData2[ssid2.did][1])]).to.deep.equal({ 'solved': 'problem' })
      expect(channelData2[ssid2.did][2][Object.keys(channelData2[ssid2.did][2])]).to.deep.equal({ 'attendTo': 'wishes' })
    })

    it('should be able to import attested (linked) claims in multiple channels (in ephemeral connector)', async () => {
      let ssid = await discipl.newSsid('ephemeral')
      let ssid2 = await discipl.newSsid('ephemeral')
      let ssid3 = await discipl.newSsid('ephemeral')

      await discipl.allow(ssid)
      await discipl.allow(ssid2)

      let link = await discipl.claim(ssid, { 'need': 'food' })
      let link2 = await discipl.claim(ssid2, { 'match': link })
      let link3 = await discipl.claim(ssid3, { 'solved': link2 })

      let ld = await discipl.exportLD(link3, ssid3)

      // reset ephemeral connector (in memory mode)
      let ConnectorModuleClass = await loadConnector('ephemeral')
      discipl.registerConnector('ephemeral', new ConnectorModuleClass())

      let result = await discipl.importLD(ld, ssid.did)
      expect(result).to.equal(true)

      let channelData = await discipl.exportLD(ssid.did, ssid)
      expect(channelData[ssid.did][0][Object.keys(channelData[ssid.did][0])]).to.deep.equal({ 'need': 'food' })
      let channelData2 = await discipl.exportLD(ssid2.did, ssid)
      expect(channelData2[ssid2.did][0][Object.keys(channelData2[ssid2.did][0])]).to.deep.equal({ 'match': { [ssid.did]: [{ [link]: { 'need': 'food' } }] } })
      let channelData3 = await discipl.exportLD(link3, ssid)
      expect(channelData3[ssid3.did][0][Object.keys(channelData3[ssid3.did][0])]).to.deep.equal({ 'solved': { [ssid2.did]: [{ [link2]: { 'match': { [ssid.did]: [{ [link]: { 'need': 'food' } }] } } }] } })
    })
  },
  describe('The disciple core API with mocked connector', () => {
    before(() => {
      discipl = new DisciplCore()
    })
    it('should be able to retrieve a new mocked ssid asynchronously', async () => {
      let newIdentityStub = sinon.stub().returns({ did: ''.padStart(88, '1'), privkey: ''.padStart(88, '2') })
      let stubConnector = { newIdentity: newIdentityStub }

      await discipl.registerConnector('mock', stubConnector)
      let ssid = await discipl.newSsid('mock')

      expect(newIdentityStub.calledOnce).to.equal(true)
      expect(ssid.privkey).to.equal(''.padStart(88, '2'))
      expect(ssid.did).to.equal(''.padStart(88, '1'))
    })

    it('should be able to add a claim to some new channel through a claim() method through a mocked connector', async () => {
      let ssid = { did: 'did:discipl:mock:111', privkey: 'SECRET_KEY' }
      let claimStub = sinon.stub().returns('link:discipl:mock:claimRef')

      let stubConnector = { claim: claimStub }

      await discipl.registerConnector('mock', stubConnector)
      let claimlink = await discipl.claim(ssid, { 'need': 'beer' })

      expect(claimStub.callCount).to.equal(1)
      expect(claimStub.calledOnceWith('did:discipl:mock:111', 'SECRET_KEY', { 'need': 'beer' })).to.equal(true)

      expect(claimlink).to.equal('link:discipl:mock:claimRef')
    })

    it('should be able to express a claim with a expected attester', async () => {
      let ssid = { did: 'did:discipl:mock:111', privkey: 'SECRET_KEY' }
      let attester = { did: 'did:discipl:mock:222', privkey: 'SECRET_KEY' }
      let claimStub = sinon.stub().returns('link:discipl:mock:claimRef')

      let stubConnector = { claim: claimStub }

      await discipl.registerConnector('mock', stubConnector)
      await discipl.claim(ssid, { 'need': 'beer' }, attester)

      expect(claimStub.callCount).to.equal(1)
      expect(claimStub.calledOnceWith('did:discipl:mock:111', 'SECRET_KEY', { 'need': 'beer' }, 'did:discipl:mock:222')).to.equal(true)
    })

    it('should be able to do an allow claim with a scope', async () => {
      let ssid = { did: 'did:discipl:mock:111', privkey: 'SECRET_KEY' }
      let claimStub = sinon.stub().returns('link:discipl:mock:claimRef')

      let stubConnector = { claim: claimStub }

      await discipl.registerConnector('mock', stubConnector)
      await discipl.allow(ssid, 'link:discipl:abcabc')

      expect(claimStub.callCount).to.equal(1)
      expect(claimStub.args[0]).to.deep.equal(['did:discipl:mock:111', 'SECRET_KEY', { 'DISCIPL_ALLOW': { 'scope': 'link:discipl:abcabc' } }])
    })

    it('should be able to do an allow claim with a did', async () => {
      let ssid = { did: 'did:discipl:mock:111', privkey: 'SECRET_KEY' }
      let claimStub = sinon.stub().returns('link:discipl:mock:claimRef')

      let stubConnector = { claim: claimStub }

      await discipl.registerConnector('mock', stubConnector)
      await discipl.allow(ssid, null, 'did:discipl:mock:222')

      expect(claimStub.callCount).to.equal(1)
      expect(claimStub.args[0]).to.deep.equal(['did:discipl:mock:111', 'SECRET_KEY', { 'DISCIPL_ALLOW': { 'did': 'did:discipl:mock:222' } }])
    })

    it('should be able to add a claim to some new channel through a claim() method through a mocked connector', async () => {
      let ssid = { did: 'did:discipl:mock:111', privkey: 'SECRET_KEY' }
      let claimStub = sinon.stub().returns('link:discipl:mock:claimRef')

      let stubConnector = { claim: claimStub }

      await discipl.registerConnector('mock', stubConnector)
      let claimlink = await discipl.claim(ssid, { 'need': 'beer' })

      expect(claimStub.callCount).to.equal(1)
      expect(claimStub.calledOnceWith('did:discipl:mock:111', 'SECRET_KEY', { 'need': 'beer' })).to.equal(true)

      expect(claimlink).to.equal('link:discipl:mock:claimRef')
    })

    it('should be able to get a claim added through claims', async () => {
      let claimlink = 'link:discipl:mock:claimRef'
      let prevClaimlink = 'link:discipl:mock:previous'

      let getStub = sinon.stub().returns({ 'data': { 'need': 'wine' }, 'previous': prevClaimlink })

      let stubConnector = { get: getStub }
      await discipl.registerConnector('mock', stubConnector)

      let claim = await discipl.get(claimlink)

      console.log(getStub.args)
      expect(getStub.calledOnceWith(claimlink)).to.equal(true)

      expect(JSON.stringify(claim.data)).to.equal(JSON.stringify({ 'need': 'wine' }))
      expect(claim.previous).to.equal(prevClaimlink)
    })

    it('should be able to get a claim added through claims with columns in the did', async () => {
      let claimlink = 'link:discipl:mock:claimRef:with:some:columns'
      let prevClaimlink = 'link:discipl:mock:previous'

      let getStub = sinon.stub().returns({ 'data': { 'need': 'wine' }, 'previous': prevClaimlink })

      let stubConnector = { get: getStub }
      await discipl.registerConnector('mock', stubConnector)

      let claim = await discipl.get(claimlink)

      expect(getStub.calledOnceWith(claimlink), 'Unexpected value for claim ref').to.equal(true)

      expect(JSON.stringify(claim.data)).to.equal(JSON.stringify({ 'need': 'wine' }))
      expect(claim.previous).to.equal(prevClaimlink)
    })

    it('should be able to attest a claim', async () => {
      let ssid = { did: 'did:discipl:mock:111', privkey: 'SECRET_KEY' }
      let claimlink = 'link:discipl:mock:claimRef'

      let claimStub = sinon.stub().returns('link:discipl:mock:attestationRef')
      let stubConnector = { claim: claimStub }

      await discipl.registerConnector('mock', stubConnector)

      let attestationLink = await discipl.attest(ssid, 'agree', claimlink)
      expect(claimStub.calledOnceWith(ssid.did, ssid.privkey, { 'agree': claimlink })).to.equal(true)

      expect(attestationLink).to.equal('link:discipl:mock:attestationRef')
    })

    it('should be able to verify an attestation', async () => {
      let ssid = { did: 'did:discipl:mock:111' }
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'
      let attestationlink = 'link:discipl:mock:attestationRef'

      let verifyStub = sinon.stub()

      verifyStub.onCall(0).returns('link:discipl:mock:attestationRef')
      // No revocations will be found
      verifyStub.onCall(1).returns(null)
      verifyStub.onCall(2).returns(null)

      let getDidOfClaimStub = sinon.stub().returns('did:discipl:mock:111')

      let stubConnector = { verify: verifyStub, getDidOfClaim: getDidOfClaimStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid.did])

      expect(verifyStub.callCount).to.equal(3)
      expect(verifyStub.args[0]).to.deep.equal(['did:discipl:mock:attestor', { agree: claimlink }, null, null])
      expect(verifyStub.args[1]).to.deep.equal(['did:discipl:mock:attestor', { revoke: attestationlink }, null, null])
      expect(verifyStub.args[2]).to.deep.equal([ssid.did, { revoke: claimlink }, null, null])

      expect(getDidOfClaimStub.calledOnce).to.equal(true)
      expect(getDidOfClaimStub.args[0]).to.deep.equal(['link:discipl:mock:claimRef'])
      expect(verifiedAttestor).to.equal(attestorSsid.did)
    })

    it('should not be able to verify an attestation, if there is no matching claim', async () => {
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'

      let verifyStub = sinon.stub().returns(null)

      let stubConnector = { verify: verifyStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid.did])

      expect(verifyStub.callCount).to.equal(1)
      expect(verifyStub.args[0]).to.deep.equal(['did:discipl:mock:attestor', { agree: claimlink }, null, null])

      expect(verifiedAttestor).to.equal(null)
    })

    it('should not be able to verify an attestation, if the attestation is revoked', async () => {
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'
      let attestationlink = 'link:discipl:mock:attestationRef'
      let attestationrevocationlink = 'link:discipl:mock:attestationRevocationRef'

      let verifyStub = sinon.stub()

      verifyStub.onCall(0).returns(attestationlink)
      // A revocation of the attestation will be found
      verifyStub.onCall(1).returns(attestationrevocationlink)
      // No revocations of the revocation will be found
      verifyStub.onCall(2).returns(null)

      let stubConnector = { verify: verifyStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid.did])

      expect(verifyStub.callCount).to.equal(3)
      expect(verifyStub.args[0]).to.deep.equal(['did:discipl:mock:attestor', { agree: claimlink }, null, null])
      expect(verifyStub.args[1]).to.deep.equal(['did:discipl:mock:attestor', { revoke: attestationlink }, null, null])
      expect(verifyStub.args[2]).to.deep.equal(['did:discipl:mock:attestor', { revoke: attestationrevocationlink }, null, null])

      expect(verifiedAttestor).to.equal(null)
    })

    it('should not be able to verify an attestation, if the claim is revoked', async () => {
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'
      let attestationlink = 'link:discipl:mock:attestationRef'
      let claimrevocationlink = 'link:discipl:mock:claimRevocationRef'

      let getDidOfClaimStub = sinon.stub().returns('did:discipl:mock:claimant')
      let verifyStub = sinon.stub()

      verifyStub.onCall(0).returns(attestationlink)
      // No revocation of the attestation will be found
      verifyStub.onCall(1).returns(null)
      // A  revocations of the claim will be found
      verifyStub.onCall(2).returns(claimrevocationlink)
      // No revocation of the revocation of the claim will be found
      verifyStub.onCall(3).returns(null)

      let stubConnector = { verify: verifyStub, getDidOfClaim: getDidOfClaimStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid.did])

      expect(verifyStub.callCount).to.equal(4)
      expect(verifyStub.args[0]).to.deep.equal(['did:discipl:mock:attestor', { agree: claimlink }, null, null])
      expect(verifyStub.args[1]).to.deep.equal(['did:discipl:mock:attestor', { revoke: attestationlink }, null, null])
      expect(verifyStub.args[2]).to.deep.equal(['did:discipl:mock:claimant', { revoke: claimlink }, null, null])
      expect(verifyStub.args[3]).to.deep.equal(['did:discipl:mock:claimant', { revoke: claimrevocationlink }, null, null])

      expect(getDidOfClaimStub.callCount).to.equal(1)

      expect(verifiedAttestor).to.equal(null)
    })

    it('should be able to observe for new verification requests', async () => {
      const subject = new Subject()
      const ssid = { did: 'did:discipl:mock:111', privkey: 'SECRET_KEY' }
      const observeStub = sinon.stub().returns({ observable: subject.asObservable(), readyPromise: Promise.resolve() })

      let stubConnector = { observeVerificationRequests: observeStub }

      await discipl.registerConnector('mock', stubConnector)
      let observeResult = await discipl.observeVerificationRequests(ssid.did)
      let resultPromise = observeResult.takeOne()
      subject.next('claim')

      expect(await resultPromise).to.eq('claim')
    })

    it('should throw an error when the "observeVerificationRequests" method is not supported by the connector', async () => {
      const ssid = { did: 'did:discipl:mock:111', privkey: 'SECRET_KEY' }
      await discipl.registerConnector('mock', { getName: sinon.stub().returns('mock') })

      try {
        await discipl.observeVerificationRequests(ssid.did)
        assert.fail()
      } catch (e) {
        expect(e).to.be.an('Error')
        expect(e.message).to.equal("The 'observeVerificationRequests' method is not supported for the 'mock' connector")
      }
    })
  }))
})
