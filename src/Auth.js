import React from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_qkHBoMLia',
      userPoolClientId: '433hmj84ennq50u27ca6frnhkm',
      region: 'us-east-1'
    }
  }
});

const AuthWrapper = ({ children }) => {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div>
          <div style={{ padding: '10px', background: '#f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
            <span>Welcome, {user.username}!</span>
            <button onClick={signOut}>Sign Out</button>
          </div>
          {children}
        </div>
      )}
    </Authenticator>
  );
};

export default AuthWrapper;
