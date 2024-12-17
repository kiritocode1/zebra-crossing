export type RedisClient = {
	scriptLoad: (script: string) => Promise<string>;
	evalsha: <TArgs extends unknown[], TData = unknown>(sha1: string, keys: string[], args: TArgs) => Promise<TData>;
	decr: (key: string) => Promise<number>;
	del: (key: string) => Promise<number>;
};





export type DenoKV = Promise<Deno.Kv>; 



type Data = boolean | number | string;
export type RedisReply = Data | Data[];




export type Options = {

    client: RedisClient;

	readonly prefix?: string;

	readonly resetExpiryOnChange?: boolean;
};