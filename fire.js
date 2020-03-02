import config from "./config"
import { sendtx } from "./send"
import { utxos as getutxos } from "./utxos"

import bsv from "bsv";
const bitindex = require('bitindex-sdk').instance();

async function fireForUTXO(privateKey, utxo, changeAddress, satoshis, hash, target) {
    if (!privateKey) { throw new Error(`shooter requires a privateKey`) }
    if (!utxo) { throw new Error(`shooter requires a utxo`) }
    if (!hash) { throw new Error(`shooter requires a hash`) }
    if (!target) { throw new Error(`shooter requires a target`) }
    if (!changeAddress) { throw new Error(`shooter requires a change address`) }
    if (!Number.isInteger(satoshis)) { throw new Error(`shooter requires an amount`) }

    const script = bsv.Script.fromASM(`${hash} ${target} OP_SIZE OP_4 OP_PICK OP_SHA256 OP_SWAP OP_SPLIT OP_DROP OP_EQUALVERIFY OP_DROP OP_CHECKSIG`);

    const tx = bsv.Transaction()
        .from([utxo])
        .change(changeAddress)
        .addOutput(bsv.Transaction.Output({
            script: script.toHex(),
            satoshis: (satoshis - 200), // how much should fee be?
        }));

    tx.sign(privateKey);

    if (tx.verify() !== true) {
        console.log("error while verifying tx for utxo", utxo);
        throw new Error(`error while verifying tx`);
    }

    const txhash = tx.uncheckedSerialize();

    //console.log(txhash);
    //const result = await bitindex.tx.send(txhash);
    const result = await sendtx(txhash);

    if (result.error) {
        console.log("error while sending tx for utxo", utxo);
        throw new Error(`error while sending tx ${result.error}`);
    }

    return result.result;
}

export async function fire(wif, num, satoshis, hash, target, backend) {
    console.log("starting transaction shooter");
    if (!wif) { throw new Error(`shooter requires a wif`) }
    if (!hash) { throw new Error(`shooter requires a hash`) }
    if (!target) { throw new Error(`shooter requires a target`) }
    if (!Number.isInteger(num)) { throw new Error(`shooter requires a num`) }
    if (!Number.isInteger(satoshis)) { throw new Error(`shooter requires an amount`) }

    const privateKey = bsv.PrivateKey(wif);
    const address = bsv.Address.fromPrivateKey(privateKey).toString();
    console.log(`loading private key that owns address ${address}`);

    const utxos = await getutxos(address);
    if (utxos.length < num) { throw new Error(`don't have enough utxos, need to split them`) }

    const sats = utxos.map(utxo => { return utxo.satoshis }).reduce((a, b) => a + b, 0);
    console.log(`found ${utxos.length} utxos worth ${sats} satoshis`);

    const expectedSpend = (num * satoshis);
    if (expectedSpend > sats) { throw new Error(`don't have enough money to send ${expectedSpend} satoshis to ${target}`) }

    let curr = 0;
    console.log("aim");
    for (const utxo of utxos) {
        const txid = await fireForUTXO(privateKey, utxo, address, satoshis, hash, target);
        if (!txid) { throw new Error(`error firing tx to target`) }

        backend.add(txid);

        curr += 1;
        console.log(`🔫 FIRE ${txid}`);

        if (curr >= num) {
            console.log(`FIRED ${curr}/${num} targets`);
            break;
        }
    }

    backend.wait();
}

