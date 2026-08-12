import{UserDetail}from"@/components/admin/admin-pages";export default async function Page({params}:{params:Promise<{userId:string}>}){return <UserDetail id={(await params).userId}/>}
