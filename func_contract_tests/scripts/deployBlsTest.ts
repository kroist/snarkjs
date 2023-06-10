import { toNano } from 'ton-core';
import { BlsTest } from '../wrappers/BlsTest';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const blsTest = provider.open(BlsTest.createFromConfig({}, await compile('BlsTest')));

    await blsTest.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(blsTest.address);

    // run methods on `blsTest`
}
