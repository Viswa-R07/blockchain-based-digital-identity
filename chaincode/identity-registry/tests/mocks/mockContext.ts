/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Context } from 'fabric-contract-api';
import { ChaincodeStub, ClientIdentity } from 'fabric-shim';
import sinon from 'sinon';

export class MockContext {
    public stub: sinon.SinonStubbedInstance<ChaincodeStub>;
    public clientIdentity: sinon.SinonStubbedInstance<ClientIdentity>;
    private state: Map<string, Buffer> = new Map();
    private history: Map<string, any[]> = new Map();
    private currentMspId: string = 'GovMSP';
    private currentSeconds: number = 1773420000;
    private currentNanos: number = 123456789;

    constructor(initialMsp: string = 'GovMSP') {
        this.currentMspId = initialMsp;
        this.stub = sinon.createStubInstance(ChaincodeStub);
        this.clientIdentity = sinon.createStubInstance(ClientIdentity);

        this.clientIdentity.getMSPID.callsFake(() => this.currentMspId);

        this.stub.createCompositeKey.callsFake((objectType: string, attributes: string[]) => {
            return `\u0000${objectType}\u0000${attributes.join('\u0000')}\u0000`;
        });

        this.stub.getState.callsFake(async (key: string) => {
            return this.state.get(key) || Buffer.from('');
        });

        this.stub.putState.callsFake(async (key: string, value: Uint8Array) => {
            const buf = Buffer.from(value);
            this.state.set(key, buf);

            // Record history entry
            const entries = this.history.get(key) || [];
            entries.push({
                txId: `tx-${Date.now()}-${entries.length + 1}`,
                timestamp: {
                    seconds: { low: this.currentSeconds, high: 0, unsigned: false },
                    nanos: this.currentNanos
                },
                isDelete: false,
                value: buf
            });
            this.history.set(key, entries);
        });

        (this.stub.getHistoryForKey as any).callsFake(async (key: string) => {
            const entries = this.history.get(key) || [];
            let index = 0;
            return {
                next: async () => {
                    if (index < entries.length) {
                        return { value: entries[index++], done: false };
                    }
                    return { value: null, done: true };
                },
                close: async () => {},
                [Symbol.asyncIterator]: function() {
                    return this;
                }
            };
        });

        this.stub.getTxTimestamp.callsFake(() => {
            return {
                seconds: { low: this.currentSeconds, high: 0, unsigned: false },
                nanos: this.currentNanos
            } as any;
        });

        this.stub.setEvent.callsFake((_name: string, _payload: Uint8Array) => {
            // No-op for mock
        });
    }

    public setCallerMsp(mspId: string): void {
        this.currentMspId = mspId;
    }

    public setTxTimestamp(seconds: number, nanos: number = 0): void {
        this.currentSeconds = seconds;
        this.currentNanos = nanos;
    }

    public getContext(): Context {
        return {
            stub: this.stub as unknown as ChaincodeStub,
            clientIdentity: this.clientIdentity as unknown as ClientIdentity
        } as Context;
    }
}
