import { IStore } from "./IStore";
import { Product } from "./Product";

import axios, { AxiosInstance } from 'axios';

export default class OpenCart implements IStore {
    products: Product<"OpenCart">[] = [];
    private _axios: AxiosInstance;

    constructor(domain: string) {
        this._axios = axios.create({
            baseURL: `https://${domain}`
        });
    }

    migrate(vendor: string, dest: IStore) {

    }

    async list() {
        try {
            const res = await this._axios.get('/index.php', {
                params: {
                    route: "feed/exporter",
                },
                responseType: "json"
            });
            console.log(`i Queried ${res.config.url}`);
            return res.data as Product<"OpenCart">[];
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            console.error(message);
            return [];
        }
    }
}
