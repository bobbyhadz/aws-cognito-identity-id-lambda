import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from 'aws-lambda';
import AWS from 'aws-sdk';

type AuthorizedEvent = APIGatewayProxyEventV2 & {
  headers: {
    authorization: string;
  };
};

export async function main(
  event: AuthorizedEvent,
): Promise<APIGatewayProxyResultV2> {
  try {
    const identityId = await getCognitoIdentityId(event.headers.authorization);
    return {body: JSON.stringify({identityId}), statusCode: 200};
  } catch (error) {
    console.log('error is: ', error);
    if (error instanceof Error) {
      return {body: JSON.stringify({error: error.message})};
    }
    return {body: JSON.stringify({error: 'Something went wrong.'})};
  }
}

export function getCognitoIdentityId(
  jwtToken: string,
): Promise<string> | never {
  const params = getCognitoIdentityIdParams(jwtToken);
  const cognitoIdentity = new AWS.CognitoIdentity();

  return cognitoIdentity
    .getId(params)
    .promise()
    .then(data => {
      if (data.IdentityId) {
        return data.IdentityId;
      }
      throw new Error('Invalid authorization token.');
    });
}

function getCognitoIdentityIdParams(jwtToken: string) {
  const {
    USER_POOL_ID,
    ACCOUNT_ID,
    IDENTITY_POOL_ID,
    AWS_DEFAULT_REGION,
  } = process.env;
  const loginsKey = `cognito-idp.${AWS_DEFAULT_REGION}.amazonaws.com/${USER_POOL_ID}`;

  return {
    IdentityPoolId: IDENTITY_POOL_ID,
    AccountId: ACCOUNT_ID,
    Logins: {
      [loginsKey]: jwtToken,
    },
  };
}
