# Pow Pow

Pow Pow is a Bitcoin proof-of-work shooter, it quickly sends a lot of proof-of-work transactions to the Bitcoin SV blockchain.

It's useful for stress testing and debugging realtime Bitcoin proof-of-work applications.

Pow Pow currently requires a Bitcoin node.

## Install

    npm install -g powpow-bitcoin

## Setup

First generate the keys in a secure location

    mkdir powerful
    cd powerful

    powpow generate


Fund the address that appears on screen. If you ever need to refer back to this address, run

    powpow address


Check your balance

    powpow balance

Split large utxos into many smaller utxos

    powpow split

💥 Fire Pow Pow!

    powpow fire 1Jpgfg9fFNKVVGxYgUhuKhdbxTSKBUnVf4


## Help

    Usage:  [options] [command]

    Options:
      -V, --version                            output the version number
      -h, --help                               output usage information

    Commands:
      generate                                 Generate address
      address                                  Display address
      balance                                  Display balance for address
      utxos                                    Display utxos for address
      split [options]                          Split utxos in preparation for firing
      fire [options] <hash> <target> [number]  Fire Pow Pow, sending `target` worth of proof-of-work to `hash`

    Usage:
      $ powpow generate
      $ powpow address
      $ powpow split
      $ powpow fire 1Jpgfg9fFNKVVGxYgUhuKhdbxTSKBUnVf4


## Frequently Asked Questions

### Where is my private key?

Your private key is generated on a .bit file in your local directory. If you put funds on it, please back it up.

### How do I connect to a remote node?

Use the environment variables below to change the node information

    RPC_HOST=127.0.0.1 RPC_USER=root RPC_PASS=bitcoin PEER_HOST=127.0.0.1 powpow fire 1Jpgfg9fFNKVVGxYgUhuKhdbxTSKBUnVf4

### How do I change the number of transactions I'm sending?

Specify the number after the address

    powpow fire 1Jpgfg9fFNKVVGxYgUhuKhdbxTSKBUnVf4 20

### How do I change the amount of satoshis I'm sending?

Specify the --satoshis flag

    powpow fire --satoshis 600 1Jpgfg9fFNKVVGxYgUhuKhdbxTSKBUnVf4

### Why are my transactions getting rejected?

Probably because the fee is too low, try sending a lower satoshi amount.

*Disclamer: This is new and experimental code, don't send a lot of money without testing first*

## TODO

- UTXO calculation could be much better, should calculate optimal size
- Add RPC_PORT env variable
- P2P

## Author

Created by [@synfonaut](https://twitter.com/synfonaut) while building [Bit.sv](https://bit.sv) and [pow.market](https://pow.market).

