import React from 'react';

export function composeProviders(providers: React.ComponentType<{ children: React.ReactNode }>[]) {
  return ({ children }: { children: React.ReactNode }) =>
    providers.reduceRight((acc, Provider) => <Provider>{acc}</Provider>, children);
}
