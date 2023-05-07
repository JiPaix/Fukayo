import { Database } from '@api/db';
import crypto from 'crypto';
import { resolve } from 'path';
import { env } from 'process';

type RefreshToken = {
  token: string,
  expire: number
  master?: boolean
}

type AuthorizedToken = {
  token: string,
  expire: number
  parent: string
  master?: boolean
}
type Tokens = {
  refreshTokens: RefreshToken[],
  authorizedTokens: AuthorizedToken[]
}

export default class TokenDatabase extends Database<Tokens> {
  static #instance: TokenDatabase;

  constructor(tokens: { accessToken: string, refreshToken: string }) {
    super(resolve(env.USER_DATA, 'access_db.json'), { authorizedTokens: [], refreshTokens: [] });
    // remove expired or master tokens
    this.data.authorizedTokens = this.data.authorizedTokens.filter(t => t.expire > Date.now() && !t.master);
    this.data.refreshTokens = this.data.refreshTokens.filter(t => t.expire > Date.now() && !t.master);
    // add new tokens
    const refresh = { token: tokens.refreshToken, expire: Date.now() + 1000 * 60 * 60 * 24 * 7, master: true };
    this.data.refreshTokens.push(refresh);
    const authorized = { token: tokens.accessToken, expire: Date.now() + 1000 * 60 * 60 * 24 * 7, parent: refresh.token, master: true };
    this.data.authorizedTokens.push(authorized);
    // save
    this.write();
  }

  static getInstance(tokens?: { accessToken: string, refreshToken: string }): TokenDatabase {
    if (!this.#instance) {
      if(!tokens) throw Error('getInstance requires constructor tokens');
      this.#instance = new this(tokens);
    }
    return this.#instance;
  }

  isExpired(token: RefreshToken) {
    return token.expire < Date.now();
  }
  areParent(parent:RefreshToken, child:AuthorizedToken) {
    return parent.token === child.parent;
  }

  isValidAccessToken(token: string) {
    const tok = this.findAccessToken(token);
    if(!tok) return false;
    return tok.expire > Date.now();
  }

  async generateAccess(refresh: RefreshToken, master = false) {
    const token = crypto.randomBytes(32).toString('hex');
    const in5minutes = Date.now() + (5 * 60 * 1000);
    const authorized = { token, expire: in5minutes, parent: refresh.token, master };
    await this.addAccessToken(authorized);
    return authorized;
  }
  async generateRefresh(master = false) {
    const token = crypto.randomBytes(32).toString('hex');
    const in7days = Date.now() + (7 * 24 * 60 * 60 * 1000);
    const refresh = { token, expire: in7days, master };
    await this.addRefreshToken(refresh);
    return refresh;
  }

  findAccessToken(token: string) {
    return this.data.authorizedTokens.find(t => t.token === token);
  }

  findRefreshToken(token: string) {
    return this.data.refreshTokens.find(t => t.token === token);
  }

  removeAccessToken(access: AuthorizedToken) {
    this.data.authorizedTokens = this.data.authorizedTokens.filter(t => t.token !== access.token);
  }

  removeRefreshToken(refresh: RefreshToken) {
    this.data.authorizedTokens = this.data.authorizedTokens.filter(t => t.parent !== refresh.token);
    this.data.refreshTokens = this.data.refreshTokens.filter(t => t.token !== refresh.token);
  }

  addAccessToken(token: AuthorizedToken) {
    this.data.authorizedTokens.push(token);
    return this.write();
  }

  addRefreshToken(token: RefreshToken) {
    this.data.refreshTokens.push(token);
    return this.write();
  }
}
