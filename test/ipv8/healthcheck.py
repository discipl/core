import sys
import requests
import json 

try:
    peers_request = requests.get('http://localhost:14410/attestation?type=peers')

    if peers_request.status_code != 200:
        exit(1)

    peers = json.loads(peers_request.text)

    if 'K1ifTZ++hPN4UqU24rSc/czfYZY=' not in peers or 'eGU/YRXWJB18VQf8UbOoIhW9+xM=' not in peers:
        exit(1)

except:
    exit(1)
