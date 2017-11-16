
## Discipl Core api

For the WHY and HOW of Discipl Core: see http://discipl.org and presentation in the docs folder
(as presented on a first open source ecosystem meetup).

Below you can find the description of the common interface implemented by discipl core bindings:

  - dclocal : simply stores claims (and attestations) locally in an array tied to a DID
  - dciota  : stores claims (and attestations) in IOTA MAM channels (on the distributed IOTA tangle) tied to a DID

Note this library is in early development. Expect things to be broken. Do not use in production.

## Installation

```
yarn install
```

## Basic Usage

this package will export the DCLOCAL and DCIOTA bindings that export a similair interface as explained (below)

### `setIOTANode`
Sets the IOTA node to connect to. Use a provider URL like: http://iota.discipl.org:14265.
```
setIOTANode(iotaNodeUrl)
```

### `getDid`
Retrieves the DID (did.discipl...) tied to the given private key in the current store
```
getDid(pkey)
```

### `claim`
Stores the given (JSON-LD) claim into the store using an account tied to the subject (an id) in the given linked data triples
which has to be tied to the given private key. All triples should be about the same subject. NB in case of IOTA the pkey is the seed
used by the subject. returns reference to the claim (an universlly unique id)
```
function claim(obj, pkey)
```

### `attest`
Stores an attestation of the given (JSON-LD) claim into the store using a given attestor did with corresponding private key (of the attestor)
the claim is not stored itself but only a keyed hash of it for which the given hashkey is used. The keys are not stored anywhere.
A reference to the stored attestation is returned
```
function attest(obj, pkey, hashkey)
```

### `verify`
evaluates whether the store contains an attestation of the given (JSON-LD) claim attested by (one of) the given attestor(s) using the given hashkey
```
function verify(obj, attestor_did, hashkey)
```

### `revoke`
Not Yet Implemented: revokes a particular claim. Verification of a revoked claim or attestation of a claim will result in false.
```
function revoke(ref, pkey)
```

### `getByReference`
the only getter for now is one that requires a direct reference
```
function getByReference(ref, did)
```
