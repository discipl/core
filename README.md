
## Discipl Core API

For the WHY and HOW of Discipl Core: see http://discipl.org and presentation in the docs folder
(as presented on a first open source ecosystem meetup).

Below you can find the description of the common interface implemented by discipl core connectors:

  - local : simply stores claims (and attestations) locally in an array tied to a DID. Note that this is currently not encrypted.
  - iota  : stores claims (and attestations) in public IOTA MAM channels (on the distributed IOTA tangle) that are tied to a DID
 
The following connectors will be added in near future:

  - irma
  - blockchain
  - ethereum
  - trustchain : see tribler.org
  - leopardledger
  - forus
 
Other connectors may be included in near future:

 - rchain
 - sovrin 
 - secure scuttlebutt
 - ...

Note this library is in early development. Do not use in production.

## Installation

```
yarn install
```

## Basic Usage

this package will export the connectors that export a similair interface as explained in the API (below)

```
npm install discipl-core
```

then in Node:

```
const discipl = require('discipl-core')
const Mam = require('mam.client.js/lib/mam.node.js')
const iotaConnector = new discipl.connectors.iota(Mam, new IOTA({ provider: 'http://node.discipl.org:14265' }))
var mamState = discipl.initState(iotaConnector, seed)
const attestorDid = await discipl.getDid(iotaConnector, mamState)
console.log("Attestor DID: " + attestorDid);
var { mamState, message, attachResult } = await discipl.claim(iotaConnector, mamState, {'msg':'Hello World!'});
...
```

see examples folder for more example code

## API

Note: every API call takes a Discipl Connector as first parameter. This is not repeated for every method description below:

### `initState`
IOTA only: initialises the MAM state in the iota binding. returns the mamState object. Note that the Discipl IOTA connector also provides a (de)serialize method for the mamState object. 
The initData should be the IOTA wallet seed (a private key) to which the MAM channel will be bound. Note that this seed stays local.
```
initState(initData)
```

### `getDid`
Retrieves the DID (did.discipl...) tied to the given private key in the current store
```
getDid(conn, pkey)
```

### `claim`
Stores the given (JSON-LD) claim into the store using an account tied to the subject (an id) in the given linked data triples
which has to be tied to the given private key. All triples should be about the same subject. NB in case of IOTA the pkey is the seed
used by the subject. returns a reference to the claim (an universlly unique id). Note the method attaches the claim to the tangle causing PoW to be done.
```
function claim(conn, obj, pkey)
```

### `attest`
Stores an attestation of the given (JSON-LD) claim into the store using a given attestor did with corresponding private key (of the attestor)
the claim is not stored itself but only a keyed hash of it for which the given hashkey is used. The keys are not stored anywhere.
A reference to the stored attestation is returned
```
function attest(conn, obj, pkey, hashkey)
```

### `attestByReference`
Stores an attestation of the claim a given claim reference refers to into the store using a given attestor did with corresponding private key (of the attestor)
the referred claim is not stored itself but only a claim containing the reference.
A reference to the stored attestation is returned
```
function attestByReference(conn, obj, reference)
```

### `exportLD`
Returns a json object containing all messages in the channel of the given did. references to claims in other channels are followed recursively
```
function exportLD(conn, did)
```

### `verify`
evaluates whether the store contains an attestation at the address ref of the given (JSON-LD) claim object attested by (one of) the given attestor(s) using the given hashkey
note currently only capable of receiving one attestor did.
```
function verify(conn, ref, attestor_did, obj, hashkey)
```

### `revoke`
Not Yet Implemented: revokes a particular claim. Verification of a revoked claim or attestation of a claim will result in false.
```
function revoke(conn, ref, pkey)
```

### `getByReference`
the only getter for now is one that requires a direct reference
```
function getByReference(conn, ref, did)
```
