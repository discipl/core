<img align="left" width="100" height="100" style="margin: 25px 25px 5px 5px" src="discipl.svg">

## Discipl Core

[![Build Status](https://travis-ci.org/discipl/core.svg?branch=master)](https://travis-ci.org/discipl/core)

<br/>
NOTE: Look at our website (http://discipl.org) or see the  main repository (https://github.com/discipl/main) for the explanation of what Discipl is about?

## The Discipl Core API

This API is a javascript ES6 module intended for client side usage. It is intended to run in NodeJS, React Native (through expo.io) and JS engines in webbrowsers. With it you can let actors create self sovereign id's, let them make claims about themselves, attest claims of others, verify claim attestations and possibly revoke claims. The self sovereign id is a string with DID syntax (https://github.com/WebOfTrustInfo/rebooting-the-web-of-trust-fall2017/blob/master/draft-documents/did-primer.md) denoting a supported platform which is any platform that supports storing claims in relation to a public id, contained in the DID, and enforces that only a holder of a corresponding private key can make claims in relation to that id. The claims in relation to a particular DID form a channel and can link to claims in other channels. These claims are attestations. The API contains a method to see whether a particular claim is attested by one or more particular other DID's. Further it contains functions to retrieve claims in channels, monitor channels and even traverse or fetch all data in the linked channels.

In essence the API is therefore a linked data client that can crawl over all used and supported platforms that attestations link to. Doing so it can export or you can traverse a linked data set for all kinds of processing like feeding a dashboard based on R with discipl-R. There are a lot of platforms that can be used: distributed public ledgers, permissioned ledgers but also more private self sovereign identity / verifiable claims or verifiable credentials solutions. The specifics of the platform used determines how safe it is to put what kind of information in claims and what functionality is available. So note that discipl core does not prohibit you to put sensitive information in public if you choose the wrong platform. Note that self sovereign identities are meant to be relatively short lived and it's usage bounded by a use case to prevent privacy issues because of linkabillity, even with seemingly anonymous information.

Discipl Core is meant to be lean and simple and it does not impose usage of metadata on data. It only enforces and therefore structures linked data to have always self sovereign id's as subject of the linked data triples and that the holder of a private key related to this self sovereign id as public key is the only one that can store such triples, we call claims. It therefore will not necessarily comply fully with standards like the W3C verifiable credentials specification but will follow it's own path as it's usage is more broad than only verifiable credentials. It may provide access to functionality provided by platforms that do comply with the verifiable credentials standard.


## Terminology

term | description
--- | ---
*self sovereign id* (SSID) | A random identifier an actor chooses/generates for him/herself to refer to him/herself in subsequent communication. This identifier mostly is a public key belonging to a private key. The holder of that key can use it to make claims exclusively in relation to this self sovereign id. Within Discipl Core we use a DID like syntax for this identifier, so when referring to the "DID" of an actor we also mean this self sovereign id of the actor. Note that self sovereign identities are meant to be relatively short lived and bounded by use case.
*claim* | One or more subject-predicate-object triples, typically stored as JSON-LD with no metadata where the subject is always the DID (or reference to this in the form of "I") of the actor that created the claim. The predicate is any string and required. The object, a string, is optional.
*channel* | Set of claims with the same subject (same DID)
*attestation* | A claim with a link to some other claim (could be a claim with the same subject, thus in the same channel). For example, a student claims that he/she is in possession of a PhD in engineering. The university can agree (attest) to this claim by making an new claim that refers to the claim of the student.
*link* | The link is either a platform specific reference (if the platforms supports that and it's immutability is to be trusted, or it is intended to be mutable) and / or it can contain a proof, for instance a signature. The link always denotes a platform it refers to and does this by using a notation similar to the DID notation. So like a link a DID refers to a specific platform and therefore often can also be used as a link to the first claim in it's channel. Examples:<br>- *link by reference (of a DID or transaction)* : link:discipl:iota:DJI99DSKNSNDL99WDSDNSDNLLWNWNWQQNLSDNSDN9SD999SDSDNKNJSND9DSHPLVZ<br>- *link by proof* : link:discipl:ephemeral:LIwew77897wer[=87s9ydh]sd999sdnkLIJEOJJ#*Y*YOjjjhskds93k4n3knk9fs<br>(above examples are just an indication)
*platform* | Any operational technology capable of storing/retrieving claims in relation to self sovereign id's
*linked data export* | Given a DID, one can export all claims of that DID and all claims in channels with claims linked by reference in those claims and all claims in channels with claims referenced in those claims and so on. Stopping at circular references one can export or iteratively traverse a whole dataset. Note that a separate DID should be used for a single process in a single use case which should make the dataset limited. Dependent on the use case it can become fairly big though. Discipl connectors optionally support the import of exported data too.

## supported platforms

Many platforms can be supported to become part of the discipl platform.

At the moment just a few have initial implementations that are up to date, most are planned, others desired. All these supported platforms have their own connector repository.

- [Ephemeral](https://github.com/discipl/discipl-core-ephemeral) : local in memory storage of claims. Offers both a client side and client-server modus
- [NLX](https://github.com/discipl/discipl-core-nlx) : special type of connector to legacy API's through the NLX network
- IOTA : (currently being updated)
- Fabric : (development will start soon)
- IPV8 : needs to be updated
- uPort : needs to be updated
- ...

Platform connectors implement the connector interface defined in the [BaseConnector](https://github.com/discipl/discipl-core-baseconnector).

Private wallet solutions might get a different kind of interface that implement issue() and validate() methods apart from the Core API. Currently the only component doing so is discipl-paper-wallet, but other platforms like IRMA, Sovrin, uPort, WeMe, IPV8 based wallet etc. might follow soon.

Note this library and all connectors are in development. Do not use in production (yet).

## Basic Usage

This ES6 module will export the main interface to use discipl-core. It will automatically require modules when needed. Of course it doesn't install them for you so make sure all connector modules for platforms you want to support are installed. Make sure you configure the connector modules within your code before using the discipl core api or rely on the default operation that the connector uses a [discipl node](https://github.com/discipl/node). By default, connectors should expect a local discipl node but you will be able to set a custom URL. The platforms that are made available through this node will be automatically required and configured.

Where needed you create a self sovereign identity for a given platform, mainly consisting of a public-private key where the public key is contained in a corresponding DID. You are responsible for persisting these keys yourself if necessary. If you want to use a previously created identity, you must set it. Sometimes however, you do not have to set a identity for instance if you are only going to read information from a public platform.

Note that self sovereign identities are meant to be relatively short lived and bounded by use case. The discipl-abundance-service and discipl-law-reg modules are intended to be able to automatically create ssid's for actors bounded by the actor's usage of use cases within published law and regulations and can let actors choose a connector to keep them safe and automatically remembered when needed.

The API enables you to create an identity, create claims and retrieve claims. It enables you to export and optionally import linked claims and it enables you to mark claims as being revoked and optionally enables access control on reading channels by other DID's

## Installation

Node comes with npm installed so you should have a version of npm, however npm gets updated more frequently than node does, so you'll want to make sure it's the latest version.
```

sudo npm install npm -g
```

then in your NodeJS script:

```
const discipl = require('@discipl/core')
const ssid = discipl.newSsid('ephemeral')
discipl.claim(ssid, {'need':'beer'}).then(console.log).catch(console.log)
```

Most methods are asynchronous so will return Promises, something which we prefer over using callbacks.

See examples folder for more example code (coming soon)

## Development

clone the discipl-core repository
```
git clone git@github.com:discipl/core.git
```
Switch to core directory, install and test

```
cd core
npm install
npm test
```

## API
