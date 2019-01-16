/* eslint-env mocha */
import { expect } from 'chai'
import * as discipl from '../src/index.js'

import sinon from 'sinon'

describe('desciple-core-api', () => {
  describe('The disciple core API with memory connector', () => {
    it('should be able to get the connector asynchronously', async () => {
      const connector = await discipl.getConnector('memory')
      expect(connector.getName()).to.equal('memory')

      expect(connector.getName(), 'when loaded for the second time').to.equal('memory')
    })

    it('should be able to retrieve a new ssid asynchronously', async () => {
      let ssid = await discipl.newSsid('memory')

      expect(ssid.pubkey).to.be.a('string')
      expect(ssid.pubkey.length).to.equal(88)
      expect(ssid.privkey).to.be.a('string')
      expect(ssid.privkey.length).to.equal(88)
      expect(ssid.pubkey).to.not.equal(ssid.privkey)
      expect(ssid.did).to.equal('did:discipl:memory:' + ssid.pubkey)
      expect(ssid.connector.getName()).to.equal('memory')
    })

    it('should be able to add a first claim to some new channel through a claim() method', async () => {
      let ssid = await discipl.newSsid('memory')
      let claimlink = await discipl.claim(ssid, { 'need': 'beer' })

      expect(claimlink).to.be.a('string')
      expect(claimlink.length).to.equal(108)
    })

    it('should be able to get a claim added through claim, with link to previous', async () => {
      let ssid = await discipl.newSsid('memory')
      let claimlink1 = await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let claim = await discipl.get(claimlink2)
      expect(JSON.stringify(claim.data)).to.equal(JSON.stringify({ 'need': 'wine' }))
      expect(claim.previous).to.equal(claimlink1)
    })

    it('should be able to attest to a second claim in a chain', async () => {
      let ssid = await discipl.newSsid('memory')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('memory')

      let attestationLink = await discipl.attest(attestorSsid, 'agree', claimlink2)

      let attestation = await discipl.get(attestationLink)

      expect(attestation.data.agree).to.equal(claimlink2)
      expect(attestation.previous).to.equal(null)
    })

    it('should be able to verify an attestation', async () => {
      let ssid = await discipl.newSsid('memory')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('memory')

      await discipl.attest(attestorSsid, 'agree', claimlink2)

      let verifiedAttestor = await discipl.verify('agree', claimlink2, [ssid, null, { 'did': 'did:discipl:memory:1234' }, attestorSsid])

      // The first ssid that is valid and proves the attestation should be returned
      expect(verifiedAttestor).to.equal(attestorSsid)
    })

    it('should be able to not verify an attestation of a revoked claim', async () => {
      let ssid = await discipl.newSsid('memory')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('memory')

      await discipl.attest(attestorSsid, 'agree', claimlink2)
      await discipl.revoke(ssid, claimlink2)

      let verifiedAttestor = await discipl.verify('agree', claimlink2, [attestorSsid])

      // The first ssid that is valid and proves the attestation should be returned
      // but none such was given so it should not find any matching attestor
      expect(verifiedAttestor).to.equal(null)
    })

    it('should be able to export linked verifiable claim channels', async () => {
      let ssid = await discipl.newSsid('memory')
      await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let attestorSsid = await discipl.newSsid('memory')

      let attestationLink = await discipl.attest(attestorSsid, 'agree', claimlink2)
      let exportedData = await discipl.exportLD(attestorSsid)

      expect(exportedData[attestorSsid.did][attestationLink]['agree'][ssid.did][claimlink2]).to.deep.equal({ 'need': 'wine' })
    })

    it('should be able to export multiple (linked) verifiable claims in a channel in order', async () => {
      let ssid = await discipl.newSsid('memory')
      let claimlink1 = await discipl.claim(ssid, { 'need': 'beer' })
      let claimlink2 = await discipl.claim(ssid, { 'need': 'wine' })

      let ssid2 = await discipl.newSsid('memory')
      let claimlink3 = await discipl.claim(ssid2, { 'need': 'water' })

      let attestationLink = await discipl.attest(ssid, 'agree', claimlink3)
      let exportedData = await discipl.exportLD(ssid)

      console.log(JSON.stringify(exportedData))

      expect(Object.keys(exportedData[ssid.did])[0]).to.equal(claimlink1)
      expect(Object.keys(exportedData[ssid.did])[1]).to.equal(claimlink2)
      expect(Object.keys(exportedData[ssid.did])[2]).to.equal(attestationLink)
      expect(exportedData[ssid.did][claimlink1]).to.deep.equal({ 'need': 'beer' })
      expect(exportedData[ssid.did][claimlink2]).to.deep.equal({ 'need': 'wine' })
      expect(exportedData[ssid.did][attestationLink]['agree'][ssid2.did][claimlink3]).to.deep.equal({ 'need': 'water' })

    })

  },
  describe('The disciple core API with mocked connector', () => {
    it('should be able to retrieve a new mocked ssid asynchronously', async () => {
      let newSsidStub = sinon.stub().returns({ pubkey: ''.padStart(88, '1'), privkey: ''.padStart(88, '2') })
      let getNameStub = sinon.stub().returns('mock')
      let stubConnector = { newSsid: newSsidStub, getName: getNameStub }

      await discipl.registerConnector('mock', stubConnector)
      let ssid = await discipl.newSsid('mock')

      expect(newSsidStub.calledOnce).to.equal(true)
      expect(getNameStub.calledOnce).to.equal(true)

      expect(ssid.pubkey).to.equal(''.padStart(88, '1'))
      expect(ssid.privkey).to.equal(''.padStart(88, '2'))
      expect(ssid.did).to.equal('did:discipl:mock:' + ''.padStart(88, '1'))
      expect(ssid.connector.getName()).to.equal('mock')
    })

    it('should be able to add a claim to some new channel through a claim() method through a mocked connector', async () => {
      let ssid = { did: 'did:discipl:mock:111' }
      let claimStub = sinon.stub().returns('claimRef')
      let getNameStub = sinon.stub().returns('mock')
      let stubConnector = { claim: claimStub, getName: getNameStub }

      await discipl.registerConnector('mock', stubConnector)
      let claimlink = await discipl.claim(ssid, { 'need': 'beer' })

      expect(claimStub.calledOnceWith({ did: 'did:discipl:mock:111', connector: stubConnector, pubkey: '111' }, { 'need': 'beer' })).to.equal(true)
      expect(getNameStub.calledOnce).to.equal(true)

      expect(claimlink).to.equal('link:discipl:mock:claimRef')
    })

    it('should be able to add a claim to some new channel through a claim() method with an object as reference', async () => {
      let ssid = { did: 'did:discipl:mock:111' }
      let claimStub = sinon.stub().returns({ someKey: 'infoNeededByConnector' })
      let getNameStub = sinon.stub().returns('mock')
      let stubConnector = { claim: claimStub, getName: getNameStub }

      await discipl.registerConnector('mock', stubConnector)
      let claimlink = await discipl.claim(ssid, { 'need': 'beer' })

      expect(claimStub.calledOnceWith({ did: 'did:discipl:mock:111', connector: stubConnector, pubkey: '111' }, { 'need': 'beer' })).to.equal(true)
      expect(getNameStub.calledOnce).to.equal(true)

      expect(claimlink).to.equal('link:discipl:mock:jdkIBFi8PojrrOV/Z9qtuS+8hDyUUMUkono9Rof4ZxlA6OIQjOWcHeSWGD73fn2I')
    })

    it('should be able to get a claim added through claims', async () => {
      let claimlink = 'link:discipl:mock:claimRef'
      let prevClaimlink = 'link:discipl:mock:previous'

      let getStub = sinon.stub().returns({ 'data': { 'need': 'wine' }, 'previous': 'previous' })
      let getNameStub = sinon.stub().returns('mock')

      let stubConnector = { get: getStub, getName: getNameStub }
      await discipl.registerConnector('mock', stubConnector)

      let claim = await discipl.get(claimlink)

      expect(getStub.calledOnceWith('claimRef', null)).to.equal(true)
      expect(getNameStub.calledOnce).to.equal(true)

      expect(JSON.stringify(claim.data)).to.equal(JSON.stringify({ 'need': 'wine' }))
      expect(claim.previous).to.equal(prevClaimlink)
    })

    it('should be able to get a claim added through claims with columns in the did', async () => {
      let claimlink = 'link:discipl:mock:claimRef:with:some:columns'
      let prevClaimlink = 'link:discipl:mock:previous'

      let getStub = sinon.stub().returns({ 'data': { 'need': 'wine' }, 'previous': 'previous' })
      let getNameStub = sinon.stub().returns('mock')

      let stubConnector = { get: getStub, getName: getNameStub }
      await discipl.registerConnector('mock', stubConnector)

      let claim = await discipl.get(claimlink)

      expect(getStub.calledOnceWith('claimRef:with:some:columns', null), 'Unexpected value for claim ref').to.equal(true)
      expect(getNameStub.calledOnce).to.equal(true)

      expect(JSON.stringify(claim.data)).to.equal(JSON.stringify({ 'need': 'wine' }))
      expect(claim.previous).to.equal(prevClaimlink)
    })

    it('should be able to attest a claim', async () => {
      let ssid = { did: 'did:discipl:mock:111' }
      let claimlink = 'link:discipl:mock:claimRef'

      let claimStub = sinon.stub().returns('attestationRef')
      let getNameStub = sinon.stub().returns('mock')
      let stubConnector = { claim: claimStub, getName: getNameStub }

      await discipl.registerConnector('mock', stubConnector)

      let attestationLink = await discipl.attest(ssid, 'agree', claimlink)
      expect(getNameStub.calledOnce).to.equal(true)
      expect(claimStub.calledOnceWith({ did: 'did:discipl:mock:111', connector: stubConnector, pubkey: '111' }, { 'agree': claimlink })).to.equal(true)

      expect(attestationLink).to.equal('link:discipl:mock:attestationRef')
    })

    it('should be able to verify an attestation', async () => {
      let ssid = { did: 'did:discipl:mock:111' }
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'
      let attestationlink = 'link:discipl:mock:attestationRef'

      let verifyStub = sinon.stub()

      verifyStub.onCall(0).returns('attestationRef')
      // No revocations will be found
      verifyStub.onCall(1).returns(null)
      verifyStub.onCall(2).returns(null)

      let getNameStub = sinon.stub().returns('mock')

      let getSsidOfClaimStub = sinon.stub().returns({ pubkey: '111' })

      let stubConnector = { verify: verifyStub, getName: getNameStub, getSsidOfClaim: getSsidOfClaimStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid])

      expect(verifyStub.calledThrice).to.equal(true)
      expect(verifyStub.args[0]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { agree: claimlink }])
      expect(verifyStub.args[1]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { revoke: attestationlink }])
      expect(verifyStub.args[2]).to.deep.equal([{ did: ssid.did, connector: stubConnector, pubkey: '111' }, { revoke: claimlink }])
      expect(getNameStub.calledTwice).to.equal(true)
      expect(getSsidOfClaimStub.calledOnce).to.equal(true)
      expect(getSsidOfClaimStub.args[0]).to.deep.equal(['claimRef'])
      expect(verifiedAttestor.did).to.equal(attestorSsid.did)
    })

    it('should not be able to verify an attestation, if there is no matching claim', async () => {
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'

      let verifyStub = sinon.stub().returns(null)

      let stubConnector = { verify: verifyStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid])

      expect(verifyStub.calledOnce).to.equal(true)
      expect(verifyStub.args[0]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { agree: claimlink }])

      expect(verifiedAttestor).to.equal(null)
    })

    it('should not be able to verify an attestation, if the attestation is revoked', async () => {
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'
      let attestationlink = 'link:discipl:mock:attestationRef'
      let attestationrevocationlink = 'link:discipl:mock:attestationRevocationRef'

      let verifyStub = sinon.stub()

      verifyStub.onCall(0).returns('attestationRef')
      // A revocation of the attestation will be found
      verifyStub.onCall(1).returns('attestationRevocationRef')
      // No revocations of the revocation will be found
      verifyStub.onCall(2).returns(null)

      let getNameStub = sinon.stub().returns('mock')

      let stubConnector = { verify: verifyStub, getName: getNameStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid])

      expect(verifyStub.callCount).to.equal(3)
      expect(verifyStub.args[0]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { agree: claimlink }])
      expect(verifyStub.args[1]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { revoke: attestationlink }])
      expect(verifyStub.args[2]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { revoke: attestationrevocationlink }])

      expect(getNameStub.callCount).to.equal(2)

      expect(verifiedAttestor).to.equal(null)
    })

    it('should not be able to verify an attestation, if the claim is revoked', async () => {
      let attestorSsid = { did: 'did:discipl:mock:attestor' }
      let claimlink = 'link:discipl:mock:claimRef'
      let attestationlink = 'link:discipl:mock:attestationRef'
      let claimrevocationlink = 'link:discipl:mock:claimRevocationRef'

      let getSsidOfClaimStub = sinon.stub().returns({ pubkey: 'claimant' })
      let verifyStub = sinon.stub()

      verifyStub.onCall(0).returns('attestationRef')
      // No revocation of the attestation will be found
      verifyStub.onCall(1).returns(null)
      // A  revocations of the claim will be found
      verifyStub.onCall(2).returns('claimRevocationRef')
      // No revocation of the revocation of the claim will be found
      verifyStub.onCall(3).returns(null)

      let getNameStub = sinon.stub().returns('mock')

      let stubConnector = { verify: verifyStub, getName: getNameStub, getSsidOfClaim: getSsidOfClaimStub }

      await discipl.registerConnector('mock', stubConnector)

      let verifiedAttestor = await discipl.verify('agree', claimlink, [attestorSsid])

      expect(verifyStub.callCount).to.equal(4)
      expect(verifyStub.args[0]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { agree: claimlink }])
      expect(verifyStub.args[1]).to.deep.equal([{ did: 'did:discipl:mock:attestor', connector: stubConnector, pubkey: 'attestor' }, { revoke: attestationlink }])
      expect(verifyStub.args[2]).to.deep.equal([{ did: 'did:discipl:mock:claimant', connector: stubConnector, pubkey: 'claimant' }, { revoke: claimlink }])
      expect(verifyStub.args[3]).to.deep.equal([{ did: 'did:discipl:mock:claimant', connector: stubConnector, pubkey: 'claimant' }, { revoke: claimrevocationlink }])

      expect(getNameStub.callCount).to.equal(3)
      expect(getSsidOfClaimStub.callCount).to.equal(1)

      expect(verifiedAttestor).to.equal(null)
    })
  })
  )
})
