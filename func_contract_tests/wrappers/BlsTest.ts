import { compile } from '@ton-community/blueprint';
import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from 'ton-core';

export type BlsTestConfig = {};

export function blsTestConfigToCell(config: BlsTestConfig): Cell {
    return beginCell().endCell();
}

export const Opcodes = {
    verify: 0x3b3cca17,
};

export async function compileAndDeploy() : Promise<[Blockchain, SandboxContract<BlsTest>]> {
    let code = await compile('BlsTest');
    let blockchain: Blockchain;
    let blsTest: SandboxContract<BlsTest>;
    blockchain = await Blockchain.create();
    // blockchain.verbosity = {
    //     print: true,
    //     blockchainLogs: true,
    //     vmLogs: 'vm_logs',
    //     debugLogs: true,
    // }

    blsTest = blockchain.openContract(BlsTest.createFromConfig({}, code));

    const deployer = await blockchain.treasury('deployer');

    const deployResult = await blsTest.sendDeploy(deployer.getSender(), toNano('0.05'));

    expect(deployResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: blsTest.address,
        deploy: true,
        success: true,
    });
    
    return [blockchain, blsTest]
}


export class BlsTest implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new BlsTest(address);
    }

    static createFromConfig(config: BlsTestConfig, code: Cell, workchain = 0) {
        const data = blsTestConfigToCell(config);
        const init = { code, data };
        return new BlsTest(contractAddress(workchain, init), init);
    }

    cellFromInputList(list: bigint[]) : Cell {
        var builder = beginCell();
        builder.storeUint(list[0], 256);
        if (list.length > 1) {
            builder.storeRef(
                this.cellFromInputList(list.slice(1))
            );
        }
        return builder.endCell()
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendVerify(
        provider: ContractProvider,
        via: Sender,
        opts: {
            pi_a: Buffer;
            pi_b: Buffer;
            pi_c: Buffer;
            pubInputs: bigint[];
            value: bigint;
            queryID?: number;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.verify, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .storeRef(
                    beginCell()
                    .storeBuffer(opts.pi_a)
                    .storeRef(
                        beginCell()
                        .storeBuffer(opts.pi_b)
                        .storeRef(
                            beginCell()
                            .storeBuffer(opts.pi_c)
                            .storeRef(
                                this.cellFromInputList(opts.pubInputs)
                            )
                        )
                    )
                )
                .endCell(),
        });
    }


    async getRes(provider: ContractProvider) {
        const result = await provider.get('get_res', []);
        return result.stack.readNumber();
    }
}
