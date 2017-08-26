// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `angular-cli.json`.

export const environment = {
  isElectron: false,
  production: false,
  baseApiUrl: 'http://localhost:8989/api/v1',
  localApiUrl: null,
  googleMapsAPIKey: 'AIzaSyAm5XiUoP1swNgmUhouBdH1pVdB2PfkI3o',
  baseProfileImageUrl: "https://s3.amazonaws.com/dev.todopro.com/user-images/profile-images-large",
  stripePublicKey: "pk_PAFUEjoj7cCw2Bb7w5ZP3i4QpHjWI"
};
