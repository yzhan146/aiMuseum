import { resolveIdentity, withIdentity } from "@/lib/identity";

export async function GET(request:Request){const identity=await resolveIdentity(request);return withIdentity(identity.account?Response.json({account:identity.account}):Response.json({account:null},{status:401}),identity);}
