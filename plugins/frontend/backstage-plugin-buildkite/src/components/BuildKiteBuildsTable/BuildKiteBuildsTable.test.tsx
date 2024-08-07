/*
 * Copyright 2021 Larder Software Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { AnyApiRef, errorApiRef } from '@backstage/core-plugin-api';
import { UrlPatternDiscovery } from '@backstage/core-app-api';
import { rest } from 'msw';
import {
  setupRequestMockHandlers,
  TestApiProvider,
  wrapInTestApp,
  MockFetchApi,
} from '@backstage/test-utils';
import { setupServer } from 'msw/node';
import {
  buildsResponseMock,
  entityMock,
  entityMockWithBranchAnnotation,
} from '../../mocks/mocks';
import { buildKiteApiRef } from '../..';
import { BuildkiteApi } from '../../api';
import { rootRouteRef } from '../../plugin';
import { BUILDKITE_BRANCH_ANNOTATION } from '../../consts';
import BuildkiteBuildsTable from './BuildKiteBuildsTable';

const postMock = jest.fn();

const errorApiMock = { post: postMock, error$: jest.fn() };
const discoveryApi = UrlPatternDiscovery.compile('http://exampleapi.com');
const fetchApi = new MockFetchApi();

const apis: [AnyApiRef, Partial<unknown>][] = [
  [errorApiRef, errorApiMock],
  [buildKiteApiRef, new BuildkiteApi({ discoveryApi, fetchApi })],
];

describe('BuildKiteBuildsTable', () => {
  const worker = setupServer();
  setupRequestMockHandlers(worker);

  beforeEach(() => jest.resetAllMocks());

  it('should display a table with the data from the requests', async () => {
    let branchParam: string | null;

    worker.use(
      rest.get(
        'http://exampleapi.com/buildkite/api/organizations/rbnetwork/pipelines/example-pipeline/builds',
        (req, res, ctx) => {
          branchParam = req.url.searchParams.get('branch');

          return res(ctx.json(buildsResponseMock));
        },
      ),
    );
    const rendered = render(
      wrapInTestApp(
        <TestApiProvider apis={apis}>
          <BuildkiteBuildsTable entity={entityMock} />
        </TestApiProvider>,
        {
          mountedRoutes: {
            '/': rootRouteRef,
          },
        },
      ),
    );

    await waitFor(() => expect(branchParam).toBeUndefined());
    expect(
      await rendered.findByText('rbnetwork/example-pipeline'),
    ).toBeInTheDocument();
    expect(
      await rendered.findByText('Update catalog-info.yaml'),
    ).toBeInTheDocument();
    expect((await rendered.findAllByText('Queued')).length).toEqual(5);
    expect((await rendered.findAllByText('main')).length).toEqual(5);
  });

  it('should display a table with the data from the requests, limited only to the specified branch when specified', async () => {
    let branchParam: string | null;
    const branch =
      entityMockWithBranchAnnotation.metadata.annotations?.[
        BUILDKITE_BRANCH_ANNOTATION
      ];

    worker.use(
      rest.get(
        'http://exampleapi.com/buildkite/api/organizations/rbnetwork/pipelines/example-pipeline/builds',
        (req, res, ctx) => {
          branchParam = req.url.searchParams.get('branch');

          return res(ctx.json(buildsResponseMock));
        },
      ),
    );
    const rendered = render(
      wrapInTestApp(
        <TestApiProvider apis={apis}>
          <BuildkiteBuildsTable entity={entityMockWithBranchAnnotation} />
        </TestApiProvider>,
        {
          mountedRoutes: {
            '/': rootRouteRef,
          },
        },
      ),
    );

    await waitFor(() => expect(branchParam).toEqual(branch));

    expect(
      await rendered.findByText('rbnetwork/example-pipeline'),
    ).toBeInTheDocument();
    expect(
      await rendered.findByText('Update catalog-info.yaml'),
    ).toBeInTheDocument();
    expect((await rendered.findAllByText('Queued')).length).toEqual(5);
    expect((await rendered.findAllByText('main')).length).toEqual(5);
  });

  it('should display an error on fetch failure', async () => {
    worker.use(
      rest.get(
        'http://exampleapi.com/buildkite/api/organizations/rbnetwork/pipelines/example-pipeline/builds',
        (_, res, ctx) => res(ctx.status(403)),
      ),
    );
    render(
      wrapInTestApp(
        <TestApiProvider apis={apis}>
          <BuildkiteBuildsTable entity={entityMock} />
        </TestApiProvider>,
        {
          mountedRoutes: {
            '/': rootRouteRef,
          },
        },
      ),
    );

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(
        new Error('failed to fetch data, status 403: Forbidden'),
      ),
    );
  });
});
