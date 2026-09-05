export class Connection {
    peer: string;
    metadata: unknown;
    open = true;
    sent: any[] = [];
    handlers = new Map<string, ((...args: any[]) => void)[]>();
    constructor(peer: string, metadata: unknown = {}) { this.peer = peer; this.metadata = metadata; }
    on(event: string, cb: (...args:any[])=>void) { const list=this.handlers.get(event)??[];list.push(cb);this.handlers.set(event,list); }
    emit(event:string,...args:any[]) { for(const cb of this.handlers.get(event)??[])cb(...args); }
    send(packet:unknown) { this.sent.push(structuredClone(packet)); }
    close() { if(!this.open)return;this.open=false;this.emit('close'); }
}
export class Peer {
    static latest: Peer;
    id: string;
    options: any;
    connections: Record<string,Connection[]> = {};
    handlers = new Map<string, ((...args: any[]) => void)[]>();
    constructor(id:string, options:unknown) { this.id=id;this.options=options;Peer.latest=this; }
    on(event:string,cb:(...args:any[])=>void) {const list=this.handlers.get(event)??[];list.push(cb);this.handlers.set(event,list);}
    emit(event:string,...args:any[]) {for(const cb of this.handlers.get(event)??[])cb(...args);}
    connect(peer:string,options:any) { const c=new Connection(peer,options.metadata);this.connections[peer]=[c];return c; }
    destroy() { for(const list of Object.values(this.connections))for(const c of list)c.close(); }
}
