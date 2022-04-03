export const isLoginValid = (login:string) => {
  return login.length > 0;
};

export const isPasswordValid = (password:string|null) => {
  return password !== null && password.length >= 6;
};

export const passwordHint = (password:string|null) => {
  // 8 chars, at least a symbol, a number and with upper and lower case chars
  const regex = /^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
  if(password === null || password.length === 0) return 'setup.passwordHint.value';
  if(regex.test(password)) return 'setup.passwordHintStrong.value';
  if(password.length >= 8) return 'setup.passwordHintAverage.value';
  return 'setup.passwordHintWeak.value';
};

export const isPortValid = (port:number) => {
  return port >= 1024 && port <= 65535;
};

export const isProvidedCertificateValid = (cert:string|null) => {
  if(!cert) return false;
  return cert.startsWith('-----BEGIN CERTIFICATE-----')
      && (cert.endsWith('-----END CERTIFICATE-----') || cert.endsWith('-----END CERTIFICATE-----\n')  );
};

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

export type authByToken = {
  token: string|null,
  refreshToken?: string|null,
}

export type authByLogin = {
  login: string
  password: string
}
