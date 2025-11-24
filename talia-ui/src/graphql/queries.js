import { gql } from '@apollo/client';

export const GET_TALIA_USER_BY_EMAIL = gql`
  query GetTaliaUserByEmail($email: String!) {
    taliaUserByEmail(email: $email) {
      id
      role
      preferences
    }
  }
`;

// Add other GraphQL queries here as needed
