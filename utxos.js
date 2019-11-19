import bsv from "bsv";

const bitindex = require('bitindex-sdk').instance();

export async function utxos(wif) {
    const address = bsv.Address.fromPrivateKey(bsv.PrivateKey(wif)).toString();
    console.log("utxos for address", address);
    const utxos = await bitindex.address.getUtxos(address);
    const sorted = utxos.sort((a, b) => {
        if (a.satoshis > b.satoshis) { return 1 }
        if (a.satoshis < b.satoshis) { return -1 }
        return 0;
    });
    return sorted;
}
