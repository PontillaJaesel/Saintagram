import { NextResponse } from "next/server"; import { adminError,noStoreHeaders,requireAdmin } from "@/lib/admin-auth";
export async function GET(request:Request){try{const token=await requireAdmin(request);return NextResponse.json({admin:true,uid:token.uid,email:token.email??null},{headers:noStoreHeaders});}catch(error){return adminError(error);}}
