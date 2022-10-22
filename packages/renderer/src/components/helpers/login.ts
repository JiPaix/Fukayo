/** Check login validity: not empty */
export const isLoginValid = (login:string|null) => {
  return login !== null && login.length > 0;
};

/**
 * Check password validity:
 * not null, not empty, at least 6 characters
 * @param password password to check
 */
export const isPasswordValid = (password:string|null) => {
  return password !== null && password.length >= 6;
};

export const passwordHint = (password:string|null) => {
  // 8 chars, at least a symbol, a number and with upper and lower case chars
  const regex = /^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
  if(password === null || password.length < 6) return 'setup.password_hints.default';
  if(regex.test(password)) return 'setup.password_hints.strong';
  if(password.length >= 8) return 'setup.password_hints.average';
  return 'setup.password_hints.weak';
};

/**
 * Check the port validity:
 *
 * number between 1024 and 65535
 * @param port port to check
 */
export const isPortValid = (port:number) => {
  return port >= 1024 && port <= 65535;
};

/**
 *  Check the url validity:
 *
 * url with protocol and hostname
 * @param hostname url to check
 */
export const isHostNameValid = (hostname:string|null) => {
  if(hostname === null) return false;
  if(!hostname.startsWith('https://')) return false;
  hostname = hostname.replace('https://', '');
  if(hostname.length < 1) return false;
  if(hostname.includes(' ')) return false;
  return true;
};

export const hostNameHint = (hostname:string|null) => {
  if(hostname === null || hostname.length < 1) return 'setup.address_errors.length';
  if(!hostname.startsWith('https://')) return 'setup.address_errors.protocol';
  if(hostname.replace('https://', '').length < 1) return 'setup.address_errors.length';
  if(hostname.includes(' ')) return 'setup.address_errors.space';
  return '';
};

/**
 * Check the SSL certificate validity
 * @param cert certificate to check
 */
export const isProvidedCertificateValid = (cert:string|null) => {
  if(!cert) return false;
  return cert.startsWith('-----BEGIN CERTIFICATE-----')
      && (cert.endsWith('-----END CERTIFICATE-----') || cert.endsWith('-----END CERTIFICATE-----\n')  );
};

/**
 * Check the SSL key validity
 * @param key key to check
 */
export const isProvidedKeyValid = (key:string|null) => {
  if(!key) return false;
  return key.startsWith('-----BEGIN PRIVATE KEY-----')
      && (key.endsWith('-----END PRIVATE KEY-----') || key.endsWith('-----END PRIVATE KEY-----\n')  );
};

export const certifColor = (cert:string|null) => {
  if(cert === null) return 'grey-8';
  if(isProvidedCertificateValid(cert)) return 'positive';
  return 'negative';
};

export const keyColor = (key:string|null) => {
  if(key === null) return 'grey-8';
  if(isProvidedKeyValid(key)) return 'positive';
  return 'negative';
};
