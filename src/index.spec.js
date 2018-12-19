import { expect, use } from "chai";
import * as discipl from '../src/index.js';

import sinon from 'sinon';

describe("desciple-core-api", () => {
    describe("The disciple core API with memory connector", () => {

        it("should be able to get the connector asynchronously", async () => {
            const connector = await discipl.getConnector("memory")
            expect(connector.getName()).to.equal("memory")

            expect(connector.getName(), "when loaded for the second time").to.equal("memory")
        })

        it("should be able to retrieve a new ssid asynchronously", async () => {
            let ssid = await discipl.newSsid('memory')

            expect(ssid.pubkey).to.be.a('string')
            expect(ssid.pubkey.length).to.equal(88)
            expect(ssid.privkey).to.be.a('string')
            expect(ssid.privkey.length).to.equal(88)
            expect(ssid.pubkey).to.not.equal(ssid.privkey)
            expect(ssid.did).to.equal('did:discipl:memory:' + ssid.pubkey)
            expect(ssid.connector.getName()).to.equal('memory')
        })

        it("should be able to add a first claim to some new channel through a claim() method", async () => {
            let ssid = await discipl.newSsid('memory')
            let claimlink = await discipl.claim(ssid, {'need': 'beer'})

            expect(claimlink).to.be.a('string')
            expect(claimlink.length).to.equal(108)
        })
    },
    describe("The disciple core API with mocked connector", () => {

        it("should be able to retrieve a new mocked ssid asynchronously", async () => {
            let newSsidStub = sinon.stub().returns({pubkey: "".padStart(88,"1"), privkey: "".padStart(88,"2")})
            let getNameStub = sinon.stub().returns("mock")
            let stubConnector = {newSsid: newSsidStub, getName: getNameStub};


            await discipl.registerConnector('mock', stubConnector)
            let ssid = await discipl.newSsid('mock')

            expect(newSsidStub.calledOnce).to.equal(true)
            expect(getNameStub.calledOnce).to.equal(true)

            expect(ssid.pubkey).to.equal("".padStart(88,"1"))
            expect(ssid.privkey).to.equal("".padStart(88, "2"))
            expect(ssid.did).to.equal('did:discipl:mock:' + "".padStart(88,"1"))
            expect(ssid.connector.getName()).to.equal('mock')
        })

        it("should be able to add a claim to some new channel through a claim() method through a mocked connector", async () => {
            let ssid = {did: 'did:discipl:mock:111'}
            let claimStub = sinon.stub().returns("claimRef");
            let getNameStub = sinon.stub().returns("mock")
            let stubConnector = {claim: claimStub, getName: getNameStub};


            await discipl.registerConnector('mock', stubConnector)
            let claimlink = await discipl.claim(ssid, {'need':'beer'})

            expect(claimStub.calledOnceWith({did: 'did:discipl:mock:111', connector: stubConnector, pubkey: '111'}, {'need':'beer'})).to.equal(true)
            expect(getNameStub.calledOnce).to.be.equal(true)


            expect(claimlink).to.equal('link:discipl:mock:claimRef')
        })

        it("should be able to add a claim to some new channel through a claim() method with an object as reference", async () => {
            let ssid = {did: 'did:discipl:mock:111'}
            let claimStub = sinon.stub().returns({someKey:"infoNeededByConnector"});
            let getNameStub = sinon.stub().returns("mock")
            let stubConnector = {claim: claimStub, getName: getNameStub};


            await discipl.registerConnector('mock', stubConnector)
            let claimlink = await discipl.claim(ssid, {'need':'beer'})

            expect(claimStub.calledOnceWith({did: 'did:discipl:mock:111', connector: stubConnector, pubkey: '111'}, {'need':'beer'})).to.equal(true)
            expect(getNameStub.calledOnce).to.be.equal(true)

            expect(claimlink).to.equal('link:discipl:mock:jdkIBFi8PojrrOV/Z9qtuS+8hDyUUMUkono9Rof4ZxlA6OIQjOWcHeSWGD73fn2I')
        })


    })
    )
})


