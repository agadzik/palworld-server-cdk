# palworld-server-cdk

## Description

Use AWS CDK to provision the infrastructure for a dedicated Palworld server using EFS with ECS and Fargate. Also includes a simple HTTP API using API Gateway and Lambda to add Discord interactions to any Discord server you manage.

## Installation

To get started, install the AWS CDK.

```bash
pnpm install -g aws-cdk
# or
npm install -g aws-cdk
# or
yarn global add aws-cdk
```

Then, install the dependencies.

```bash
pnpm install
# or
npm install
# or
yarn
```

Next, you need to configure your AWS credentials by following the instructions [here](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_auth).

Finally, you need to bootstrap your AWS environment.

```bash
cdk bootstrap --profile <your-profile-name>
```

### Discord Setup

If you want to support Discord interactions, you need to create a Discord application and bot. Follow the instructions [here](https://discord.com/developers/docs/getting-started) to create a new application and bot.

It's important to give your bot permissions to `appplications.commands` and `bot`.

Once your application bot has been created and added to your Discord server, store the `public key` value as an environment variable named `APPLICATION_PUBLIC_KEY`.

## Usage

In order to deploy the infrastructure, you need to run the following command.

```bash
APPLICATION_PUBLIC_KEY=<your-discord-app-public-key> AWS_ACCOUNT=<your-account-number> cdk deploy --profile <your-profile-name>
```

For the first install, select `y` to approve the creation of the CloudFormation stack.

## Contributing

All PRs are welcome!

## License

This project is licensed under the MIT License.
