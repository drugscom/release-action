VERSION 0.6

FROM node:16
WORKDIR /app

all:
  BUILD +npm
  BUILD +build

build:
  FROM +npm

  RUN npx -- tsc --pretty
  RUN npx -- ncc build --quiet --transpile-only
  SAVE ARTIFACT dist AS LOCAL dist

clean:
  LOCALLY
  RUN rm -rf lib
  RUN rm -rf node_modules

eslint:
  FROM +npm

  COPY .eslintignore .
  COPY .eslintrc .
  COPY .prettierignore .
  COPY .prettierrc .

  ARG CI
  IF [ "${CI}" = "true" ]
    RUN npx -- eslint --format unix src
  ELSE
    RUN npx -- eslint --color src
  END

npm:
  ENV NPM_CONFIG_LOGLEVEL=warn
  ENV NPM_CONFIG_PROGRESS=false

  COPY package.json .
  COPY package-lock.json .
  COPY tsconfig.json .

  COPY src ./src

  ARG update=false
  IF [ "${update}" = "true" ]
    RUN --no-cache npm --quiet update
    SAVE ARTIFACT package.json AS LOCAL package.json
    SAVE ARTIFACT package-lock.json AS LOCAL package-lock.json
  ELSE
    RUN npm --quiet ci
    SAVE ARTIFACT package.json
  END

  SAVE ARTIFACT node_modules AS LOCAL node_modules

test:
  BUILD +eslint
  BUILD +yamllint

yamllint:
  FROM alpine:3.15
  RUN apk --quiet --no-progress --no-cache add yamllint

  COPY .github ./.github
  COPY .yamllint.yaml .
  COPY action.yml .

  ARG CI
  IF [ "${CI}" = "true" ]
    RUN yamllint --format=parsable .
  ELSE
    RUN yamllint --format=colored .
  END