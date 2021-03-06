import React from 'react';
import { configure, shallow, mount } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import fetchMock from 'fetch-mock';

fetchMock.config.overwriteRoutes = false;

import Fetch, { SimpleCache } from './';

configure({ adapter: new Adapter() });

afterEach(fetchMock.restore);

describe('basic', () => {
  it('sets data on success', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('does not call setState if unmounted', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();
    const promises = instance.promises;
    wrapper.unmount();

    await Promise.all(promises);

    // Once for initial and once for loading, but should not be called when the response is returned
    expect(mockChildren.mock.calls.length).toBe(2);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('does not process empty body', async () => {
    const url = 'http://localhost';
    fetchMock.once(url, { status: 404 });

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: undefined,
      error: null,
      request: {},
      response: { status: 404 }
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports options as function', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const mockOptions = jest.fn();
    const options = { headers: { 'Cache-Control': 'no-cache' } };
    mockOptions.mockReturnValue(options);

    const wrapper = mount(
      <Fetch url={url} options={mockOptions}>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    expect(mockOptions.mock.calls.length).toBe(1);
    expect(fetchMock.calls(url)[0][1]).toMatchObject(options);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });
});

describe('fetching', () => {
  it('supports refetching data if "fetch" called', async () => {
    const url = 'http://localhost';
    const error = { Error: 'BOOM!' };
    fetchMock.once(url, { status: 500, body: error });
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);
    savedProps.fetch();
    await Promise.all(instance.promises);

    // Once for initial and once for loading, but should not be called when the response is returned
    expect(mockChildren.mock.calls.length).toBe(5);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Error returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      error,
      request: {},
      response: {}
    });

    // Refetching...
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data returned
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('does not fetch if url prop is undefined', async () => {
    const data = { hello: 'world' };
    fetchMock.once('*', data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(<Fetch>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    expect(instance.promises).toEqual([]);

    // // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(1);

    // // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    expect(fetchMock.called('*')).toBe(false);
  });

  it('does not fetch if url prop is false', async () => {
    const data = { hello: 'world' };
    fetchMock.once('*', data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(<Fetch url={false}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    expect(instance.promises).toEqual([]);

    // // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(1);

    // // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    expect(fetchMock.called('*')).toBe(false);
  });

  it('does not fetch if url prop is an empty string', async () => {
    const data = { hello: 'world' };
    fetchMock.once('*', data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(<Fetch url="">{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    expect(instance.promise).toBe(undefined);

    // // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(1);

    // // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    expect(fetchMock.called('*')).toBe(false);
  });

  it('does not initially fetch if "manual" prop is true/set', async () => {
    const data = { hello: 'world' };
    fetchMock.once('*', data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(
      <Fetch url="http://localhost" manual>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();

    expect(instance.promises).toEqual([]);

    // // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(1);

    // // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    expect(fetchMock.called('*')).toBe(false);
  });

  it('does not fetch if "manual" prop is set and url changes', async () => {
    const url1 = 'http://localhost/foo';
    const data1 = { name: 'foo' };
    fetchMock.get(url1, data1);
    const url2 = 'http://localhost/bar';
    const data2 = { name: 'bar' };
    fetchMock.get(url2, data2);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    // Initial url
    const wrapper = mount(
      <Fetch url={url1} manual>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();
    const promise1 = instance.promise;

    // Change url
    wrapper.setProps({ url: url2 });
    const promise2 = instance.promise;
    expect(promise2).toBe(promise1);

    expect(fetchMock.calls(url1).length).toBe(0);
    expect(fetchMock.calls(url2).length).toBe(0);
  });

  it('supports manually fetching data when "manual" prop set and "fetch" is called', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const wrapper = mount(
      <Fetch url={url} manual>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();

    await Promise.all(instance.promises); // no request made
    savedProps.fetch();
    await Promise.all(instance.promises);

    // Once for initial and once for loading, but should not be called when the response is returned
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports delaying the initial fetch by changing url prop', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    // Mount component but should not issue request
    const wrapper = mount(<Fetch>{mockChildren}</Fetch>);
    const instance = wrapper.instance();
    expect(instance.promises).toEqual([]);

    // Set url to issue request
    wrapper.setProps({ url });
    await Promise.all(instance.promises);

    // Once for mount, once for the delayed setting of url, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(4);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Setting the url but no fetch issued yet
    expect(mockChildren.mock.calls[1][0]).toMatchObject({ loading: null });

    // Loading...
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports passing options to "fetch" function but keep original url (undefined / null)', async () => {
    const url = 'http://localhost';

    const data1 = { foo: 1 };
    fetchMock.getOnce(url, data1);

    const data2 = { bar: 2 };
    fetchMock.postOnce(url, data2);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);
    savedProps.fetch(null, { method: 'post' });
    await Promise.all(instance.promises);

    // 1x initial, 2x loading, 2x data
    expect(mockChildren.mock.calls.length).toBe(5);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: data1,
      request: {},
      response: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data returned
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: false,
      data: data2,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports passing url to "fetch" function', async () => {
    const url1 = 'http://localhost/1';
    const data1 = { foo: 1 };
    fetchMock.once(url1, data1);

    const url2 = 'http://localhost/2';
    const data2 = { bar: 2 };
    fetchMock.once(url2, data2);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const wrapper = mount(<Fetch url={url1}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);
    savedProps.fetch(url2);
    await Promise.all(instance.promises);

    // 1x initial, 2x loading, 2x data
    expect(mockChildren.mock.calls.length).toBe(5);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: { url: url1 }
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: { url: url1 }
    });

    // Data returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: data1,
      request: { url: url1 },
      response: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: { url: url2 }
    });

    // Data returned
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: false,
      data: data2,
      request: { url: url2 },
      response: {}
    });

    expect(fetchMock.called(url1)).toBe(true);
    expect(fetchMock.called(url2)).toBe(true);
  });

  it('ignores/discards slow responses if later fetch is returned first (out of order)', async () => {
    const url = 'http://localhost';
    const responseData1 = { response: 1 };
    const response1 = new Promise((resolve, reject) =>
      setTimeout(() => resolve(responseData1), 300)
    );
    fetchMock.once(url, response1);

    const responseData2 = { response: 2 };
    const response2 = new Promise((resolve, reject) =>
      setTimeout(() => resolve(responseData2), 100)
    );
    fetchMock.once(url, response2);

    const responseData3 = { response: 3 };
    const response3 = new Promise((resolve, reject) =>
      setTimeout(() => resolve(responseData3), 100)
    );
    fetchMock.once(url, response3);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    // Fetch request #2
    savedProps.fetch();

    // Fetch request #3
    savedProps.fetch();

    // 2 promises are pending
    expect(instance.promises.length).toEqual(3);

    await Promise.all(instance.promises);

    // Would have been 5 if request 1 was not ignored
    expect(mockChildren.mock.calls.length).toBe(6);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading request 1
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Loading request 2 (before request 1 returns)
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Loading request 3 (before request 1 returns)
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 2 returns first
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: false,
      data: responseData2,
      request: {},
      response: {}
    });

    // Request 3 returns first
    expect(mockChildren.mock.calls[5][0]).toMatchObject({
      loading: false,
      data: responseData3,
      request: {},
      response: {}
    });

    // Request 1's response was ignored

    // All promises have been processed / removed
    expect(instance.promises.length).toEqual(0);

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports custom fetch function passed into props', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockFetch = jest.fn();
    mockFetch.mockImplementation(fetch);

    const wrapper = mount(<Fetch url={url} fetchFunction={mockFetch} />);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    expect(mockFetch).toBeCalledWith('http://localhost', undefined);
  });

  it('supports custom fetch function passed into props with custom debouncing', async () => {
    let url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.mock(url, data);

    const nonDebouncedFetch = jest.fn().mockImplementation(fetch);

    // See: https://stackoverflow.com/a/35228455/191902 or https://github.com/bjoerge/debounce-promise
    function debouncePromise(inner, ms = 0) {
      let timer = null;
      let resolves = [];

      return function(...args) {
        // Run the function after a certain amount of time
        clearTimeout(timer);
        timer = setTimeout(() => {
          // Get the result of the inner function, then apply it to the resolve function of
          // each promise that has been created since the last time the inner function was run
          let result = inner(...args);
          resolves.forEach(r => r(result));
          resolves = [];
        }, ms);

        return new Promise(r => resolves.push(r));
      };
    }

    const debouncedMockChildren = jest.fn().mockReturnValue(<div />);
    const debouncedFetchMock = jest.fn().mockImplementation(fetch);
    const debouncedFetch = jest
      .fn()
      .mockImplementation(debouncePromise(debouncedFetchMock, 10));
    const debouncedWrapper = mount(
      <Fetch url={url} fetchFunction={debouncedFetch}>
        {debouncedMockChildren}
      </Fetch>
    );
    const debouncedInstance = debouncedWrapper.instance();
    debouncedInstance.fetch();
    debouncedInstance.fetch();
    debouncedInstance.fetch();

    const nonDebouncedMockChildren = jest.fn().mockReturnValue(<div />);
    const nonDebouncedWrapper = mount(
      <Fetch url={url} fetchFunction={nonDebouncedFetch}>
        {nonDebouncedMockChildren}
      </Fetch>
    );
    const nonDebouncedInstance = nonDebouncedWrapper.instance();
    nonDebouncedInstance.fetch();
    nonDebouncedInstance.fetch();
    nonDebouncedInstance.fetch();

    await Promise.all(debouncedInstance.promises);
    await Promise.all(nonDebouncedInstance.promises);

    expect(nonDebouncedFetch).toHaveBeenCalledTimes(4);
    expect(nonDebouncedMockChildren).toHaveBeenCalledTimes(9);
    // Initial state
    expect(nonDebouncedMockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });
    // Loading request 1
    expect(nonDebouncedMockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });
    // Loading request 2
    expect(nonDebouncedMockChildren.mock.calls[2][0]).toMatchObject({
      loading: true,
      request: {}
    });
    // Loading request 3
    expect(nonDebouncedMockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });
    // Loading request 4
    expect(nonDebouncedMockChildren.mock.calls[4][0]).toMatchObject({
      loading: true,
      request: {}
    });
    // Data loaded request 1
    expect(nonDebouncedMockChildren.mock.calls[5][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });
    // Data loaded request 2
    expect(nonDebouncedMockChildren.mock.calls[6][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });
    // Data loaded request 3
    expect(nonDebouncedMockChildren.mock.calls[7][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });
    // Data loaded request 4
    expect(nonDebouncedMockChildren.mock.calls[8][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(debouncedFetch).toHaveBeenCalledTimes(4);
    expect(debouncedFetchMock).toHaveBeenCalledTimes(1);
    expect(debouncedMockChildren).toHaveBeenCalledTimes(9);

    // TODO: Find way to check data returned(not just the existence of the `data` key.  i.e.  `data: {}`)
    // TODO: Determine why there are 3 data loaded states instead of 4 (and would be nice if there was only 1)
    // Initial state
    expect(debouncedMockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });
    // Loading request 1
    expect(debouncedMockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });
    // Loading request 2
    expect(debouncedMockChildren.mock.calls[2][0]).toMatchObject({
      loading: true,
      request: {}
    });
    // Loading request 3
    expect(debouncedMockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });
    // Loading request 4
    expect(debouncedMockChildren.mock.calls[4][0]).toMatchObject({
      loading: true,
      request: {}
    });
    // Data loaded request 1
    expect(debouncedMockChildren.mock.calls[5][0]).toMatchObject({
      loading: false,
      data: {},
      request: {},
      response: {}
    });
    // Data loaded request 2, should be the same as in data 1...
    expect(debouncedMockChildren.mock.calls[6][0]).toMatchObject({
      loading: false,
      data: {},
      request: {},
      response: {}
    });
    // Data loaded request 3 and 4(?) should be the same as in data 1...
    expect(debouncedMockChildren.mock.calls[7][0]).toMatchObject({
      loading: false,
      data: {},
      request: {},
      response: {}
    });
  });
});

describe('body passing', () => {
  it('handles default (auto) with json response', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('handles default (auto) with html response', async () => {
    const url = 'http://localhost';
    const data = '<html />';
    fetchMock.once(url, {
      body: data,
      headers: { 'content-type': 'text/html' }
    });

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports "as" as a function for custom body parsing', async () => {
    const url = 'http://localhost';
    const data = { foo: 'foo' };
    fetchMock.once(url, { body: data });

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(
      <Fetch url={url} as={res => res.text()}>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: JSON.stringify(data),
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports "as" as an object with simple name for custom body parsing', async () => {
    const url = 'http://localhost';
    const date = new Date();
    const data = { someDate: date.toISOString() };
    fetchMock.once(url, { body: data });

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(
      <Fetch
        url={url}
        as={{ json: async res => JSON.parse(await res.text(), reviver) }}
      >
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: { someDate: date },
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });
});

it('supports "as" as an object with Content-Type for custom body parsing', async () => {
  const url = 'http://localhost';
  const date = new Date();
  const data = { someDate: date.toISOString() };
  fetchMock.once(url, { body: data });

  const mockChildren = jest.fn();
  mockChildren.mockReturnValue(<div />);

  const wrapper = mount(
    <Fetch
      url={url}
      as={{
        'application/json': async res => JSON.parse(await res.text(), reviver)
      }}
    >
      {mockChildren}
    </Fetch>
  );
  const instance = wrapper.instance();

  await Promise.all(instance.promises);

  // Once for initial, once for loading, and once for response
  expect(mockChildren.mock.calls.length).toBe(3);

  // Initial state
  expect(mockChildren.mock.calls[0][0]).toMatchObject({
    loading: null,
    request: {}
  });

  // Loading...
  expect(mockChildren.mock.calls[1][0]).toMatchObject({
    loading: true,
    request: {}
  });

  // Data loaded
  expect(mockChildren.mock.calls[2][0]).toMatchObject({
    loading: false,
    data: { someDate: date },
    request: {},
    response: {}
  });

  expect(fetchMock.called(url)).toBe(true);
});

describe('error handling', () => {
  it('sets error on failure', async () => {
    const url = 'http://localhost';
    const error = { Error: 'BOOM!' };
    fetchMock.once(url, { status: 500, body: error });

    const mockChildren = jest.fn().mockReturnValue(<div />);

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Error returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      error,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  // TODO: failing after upgrading fetch-mock from 5.12 to 6.3
  it.skip('sets error if exception during request (ex. CORS issue)', async () => {
    const url = 'http://localhost';
    const error = new TypeError('Failed to fetch');
    fetchMock.once(url, { status: 500, throws: error });

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    try {
      await Promise.all(instance.promises);
      fail('Promise should have rejected');
    } catch (e) {
      expect(e).not.toBeNull();
    }
    // TODO: Use the following once jest 0.20 is released:
    // https://facebook.github.io/jest/docs/expect.html#rejects
    // await expect(instance.promise).rejects.toEqual('Failed to fetch');

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Error returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      error,
      request: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('clears error after successful response', async () => {
    const url = 'http://localhost';
    const error = { Error: 'BOOM!' };
    fetchMock.once(url, { status: 500, body: error });
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const wrapper = mount(<Fetch url={url}>{mockChildren}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);
    savedProps.fetch();
    await Promise.all(instance.promises);

    // Once for initial and once for loading, but should not be called when the response is returned
    expect(mockChildren.mock.calls.length).toBe(5);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Error returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      error,
      request: {},
      response: {}
    });

    // Refetching...
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data returned
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });
    expect(mockChildren.mock.calls[4][0].error).toBeUndefined();

    expect(fetchMock.called(url)).toBe(true);
  });
});

describe('cache', () => {
  it('returns cached result if set', async () => {
    const url1 = 'http://localhost/foo';
    const data1 = { name: 'foo' };
    fetchMock.get(url1, data1);
    const url2 = 'http://localhost/bar';
    const data2 = { name: 'bar' };
    fetchMock.get(url2, data2);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    // First request
    const wrapper = mount(
      <Fetch url={url1} cache>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();
    const promise1 = instance.promises[0];

    // Second request
    wrapper.setProps({ url: url2 });
    expect(instance.promises.length).toEqual(2);
    const promise2 = instance.promises[1];
    expect(promise1).not.toBe(promise2);

    // Third, should be pulled from cache
    wrapper.setProps({ url: url1 });
    expect(instance.promises.length).toEqual(3);
    const promise3 = instance.promises[2];

    expect(promise3).toBe(promise1);
    expect(promise3).not.toBe(promise2);

    expect(fetchMock.calls(url1).length).toBe(1);
    expect(fetchMock.calls(url2).length).toBe(1);

    await Promise.all(instance.promises);

    // TODO: not sure why 8 rerendered, would expect 7 (initial + 3x loading + 3x data)
    expect(mockChildren.mock.calls.length).toBe(8);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading first request
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: { url: url1 }
    });

    // Loading second request
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: true,
      request: { url: url1 }
    });

    // Loading third request
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: { url: url2 }
    });

    // TODO: Not sure
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: true,
      request: { url: url2 }
    });

    // First request data
    expect(mockChildren.mock.calls[5][0]).toMatchObject({
      loading: false,
      data: data1,
      request: { url: url1 },
      response: {}
    });

    // Second request data
    expect(mockChildren.mock.calls[6][0]).toMatchObject({
      loading: false,
      data: data2,
      request: { url: url2 },
      response: {}
    });

    // Third request data (from cache)
    expect(mockChildren.mock.calls[7][0]).toMatchObject({
      loading: false,
      data: data1,
      request: { url: url1 },
      response: {}
    });

    // All promises have been processed
    expect(instance.promises.length).toEqual(0);
  });

  it('cache not shared between instances by default', async () => {
    const url = 'http://localhost/foo';
    const data = { name: 'foo' };
    fetchMock.get(url, data);

    // First request/instance
    const mockChildren1 = jest.fn();
    mockChildren1.mockReturnValue(<div />);
    const wrapper1 = mount(
      <Fetch url={url} cache>
        {mockChildren1}
      </Fetch>
    );
    const instance1 = wrapper1.instance();
    const promise1 = instance1.promises[0];

    // Second request/instance
    const mockChildren2 = jest.fn();
    mockChildren2.mockReturnValue(<div />);
    const wrapper2 = mount(
      <Fetch url={url} cache>
        {mockChildren2}
      </Fetch>
    );
    const instance2 = wrapper2.instance();
    const promise2 = instance2.promises[0];

    expect(promise1).not.toBe(promise2);

    // Should be called by both instances
    expect(fetchMock.calls(url).length).toBe(2);

    await Promise.all(instance1.promises);

    // Instance1
    expect(mockChildren1.mock.calls.length).toBe(3);
    expect(mockChildren1.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });
    expect(mockChildren1.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: { url }
    });
    expect(mockChildren1.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: { url },
      response: {}
    });
    // All promises have been processed
    expect(instance1.promises.length).toEqual(0);

    // Instance2
    expect(mockChildren2.mock.calls.length).toBe(3);
    expect(mockChildren2.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });
    expect(mockChildren1.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: { url }
    });
    expect(mockChildren2.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: { url },
      response: {}
    });
    // All promises have been processed
    expect(instance2.promises.length).toEqual(0);
  });

  it('should support passing a shared cache to multiple instances', async () => {
    const url = 'http://localhost/foo';
    const data = { name: 'foo' };
    const sharedCache = new SimpleCache();
    fetchMock.get(url, data);

    // First request/instance
    const mockChildren1 = jest.fn();
    mockChildren1.mockReturnValue(<div />);
    const wrapper1 = mount(
      <Fetch url={url} cache={sharedCache}>
        {mockChildren1}
      </Fetch>
    );
    const instance1 = wrapper1.instance();
    const promise1 = instance1.promises[0];

    // Second request/instance
    const mockChildren2 = jest.fn();
    mockChildren2.mockReturnValue(<div />);
    const wrapper2 = mount(
      <Fetch url={url} cache={sharedCache}>
        {mockChildren2}
      </Fetch>
    );
    const instance2 = wrapper2.instance();
    const promise2 = instance2.promises[0];

    // Should be the same instance
    expect(promise1).toBe(promise2);

    // Should only be called by the first instance
    expect(fetchMock.calls(url).length).toBe(1);

    // Instance1
    await Promise.all(instance1.promises);
    expect(mockChildren1.mock.calls.length).toBe(3);
    expect(mockChildren1.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });
    expect(mockChildren1.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: { url }
    });
    expect(mockChildren1.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: { url },
      response: {}
    });
    // All promises have been processed
    expect(instance1.promises.length).toEqual(0);

    // Instance2
    await Promise.all(instance2.promises);
    expect(mockChildren2.mock.calls.length).toBe(2);
    expect(mockChildren2.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });
    expect(mockChildren2.mock.calls[1][0]).toMatchObject({
      loading: false,
      data,
      request: { url },
      response: {}
    });
    // All promises have been processed
    expect(instance2.promises.length).toEqual(0);
  });
});

describe('children', () => {
  it('supports no children (fire and forget)', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const wrapper = mount(<Fetch url={url} />);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports children as single DOM element', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const wrapper = mount(
      <Fetch url={url}>
        <div />
      </Fetch>
    );
    const instance = wrapper.instance();

    await Promise.all(instance.promises);
    // Once for initial, once for loading, and once for response
    expect(wrapper.find('div').length).toBe(1);

    expect(fetchMock.called(url)).toBe(true);
  });
});

// TODO: Not possible until React Fiber
/*it('supports children as multiple DOM elements', async () => {
  const url = 'http://localhost';
  const data = { hello: 'world' };
  fetchMock.once('*', data);

  const wrapper = mount(
    <Fetch url={url}>
      <div />
      <div />
    </Fetch>
  );
  const instance = wrapper.instance();

  await Promise.all(instance.promises);
  // Once for initial, once for loading, and once for response
  expect(wrapper.find('div').length).toBe(2);

  expect(fetchMock.called(url)).toBe(true);
});*/

describe('onChange', () => {
  it('supports onChange prop', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockOnChange = jest.fn();

    const wrapper = mount(<Fetch url={url} onChange={mockOnChange} />);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    expect(mockOnChange.mock.calls.length).toBe(3);

    // // Initial state
    expect(mockOnChange.mock.calls[0][0]).toMatchObject({ loading: null });

    // // Loading...
    expect(mockOnChange.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // // Data loaded
    expect(mockOnChange.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('onChange is still called even if unmounted (useful for POST with redirect)', async () => {
    // TODO: Update docs to indicate the user is responsible for not calling `setState` if the component is unmounted
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockOnChange = jest.fn();

    const wrapper = mount(<Fetch url={url} onChange={mockOnChange} />);
    const instance = wrapper.instance();
    const promises = instance.promises;
    wrapper.unmount();

    await Promise.all(promises);

    // // Initial state
    expect(mockOnChange.mock.calls[0][0]).toMatchObject({ loading: null });

    // // Loading...
    expect(mockOnChange.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // // Data loaded
    expect(mockOnChange.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });
});

describe('onDataChange', () => {
  it('passes updated data to children function if `onDataChange` is set and does not return undefined', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const changedData = { hello: 'everyone' };
    const handleOnDataChange = data => changedData;

    const wrapper = mount(
      <Fetch url={url} onDataChange={handleOnDataChange}>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: changedData,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('passes updated data to `onChange` function if `onDataChange` is set and does not return undefined', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const changedData = { hello: 'everyone' };
    const handleOnDataChange = data => changedData;

    const mockOnChange = jest.fn();

    const wrapper = mount(
      <Fetch
        url={url}
        onDataChange={handleOnDataChange}
        onChange={mockOnChange}
      >
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockOnChange.mock.calls.length).toBe(3);

    // Initial state
    expect(mockOnChange.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockOnChange.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockOnChange.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: changedData,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('does not pass changes to children function if `onDataChange` does not return a result', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const handleOnDataChange = data => {};

    const wrapper = mount(
      <Fetch url={url} onDataChange={handleOnDataChange}>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('passes updated data to children function if `onDataChange` is set and returns a falsy value (ex. 0)', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const changedData = 0;
    const handleOnDataChange = data => changedData;

    const wrapper = mount(
      <Fetch url={url} onDataChange={handleOnDataChange}>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: changedData,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports modifying data using "onDataChange" and subsequent fetchs', async () => {
    const url = 'http://localhost';
    const responseData1 = { value: 1 };
    fetchMock.once(url, responseData1);

    const responseData2 = { value: 2 };
    fetchMock.once(url, responseData2);

    const responseData3 = { value: 3 };
    fetchMock.once(url, responseData3);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const handleOnDataChange = data => data.value;

    const wrapper = mount(
      <Fetch url={url} onDataChange={handleOnDataChange}>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();
    await Promise.all(instance.promises);

    // Fetch request #2
    savedProps.fetch();
    await Promise.all(instance.promises);

    // Fetch request #3
    savedProps.fetch();
    await Promise.all(instance.promises);

    // All promises are resolved
    expect(instance.promises.length).toEqual(0);

    // Would have been 5 if request 1 was not ignored
    expect(mockChildren.mock.calls.length).toBe(7);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading request 1
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 1 returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: responseData1.value,
      request: {},
      response: {}
    });

    // Loading request 2
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 2 returned
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: false,
      data: responseData2.value,
      request: {},
      response: {}
    });

    // Loading request 3
    expect(mockChildren.mock.calls[5][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 2 returned
    expect(mockChildren.mock.calls[6][0]).toMatchObject({
      loading: false,
      data: responseData3.value,
      request: {},
      response: {}
    });

    // All promises have been processed / removed
    expect(instance.promises.length).toEqual(0);

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports appending data using "onDataChange" and subsequent fetchs', async () => {
    const url = 'http://localhost';
    const responseData1 = { foo: 1 };
    fetchMock.once(url, responseData1);

    const responseData2 = { bar: 2 };
    fetchMock.once(url, responseData2);

    const responseData3 = { baz: 3 };
    fetchMock.once(url, responseData3);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const handleOnDataChange = (newData, currentData = []) => [
      ...currentData,
      newData
    ];

    const wrapper = mount(
      <Fetch url={url} onDataChange={handleOnDataChange}>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();
    await Promise.all(instance.promises);

    // Fetch request #2
    savedProps.fetch();
    await Promise.all(instance.promises);

    // Fetch request #3
    savedProps.fetch();
    await Promise.all(instance.promises);

    // All promises are resolved
    expect(instance.promises.length).toEqual(0);

    // Would have been 5 if request 1 was not ignored
    expect(mockChildren.mock.calls.length).toBe(7);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading request 1
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 1 returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: [responseData1],
      request: {},
      response: {}
    });

    // Loading request 2
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 2 returned
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: false,
      data: [responseData1, responseData2],
      request: {},
      response: {}
    });

    // Loading request 3
    expect(mockChildren.mock.calls[5][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 2 returned
    expect(mockChildren.mock.calls[6][0]).toMatchObject({
      loading: false,
      data: [responseData1, responseData2, responseData3],
      request: {},
      response: {}
    });

    // All promises have been processed / removed
    expect(instance.promises.length).toEqual(0);

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports concatenating data using "onDataChange" and subsequent fetchs', async () => {
    const url = 'http://localhost';
    const responseData1 = [1, 2, 3];
    fetchMock.once(url, responseData1);

    const responseData2 = [4, 5, 6];
    fetchMock.once(url, responseData2);

    const responseData3 = [7, 8, 9];
    fetchMock.once(url, responseData3);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const handleOnDataChange = (newData, currentData = []) => [
      ...currentData,
      ...newData
    ];

    const wrapper = mount(
      <Fetch url={url} onDataChange={handleOnDataChange}>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();
    await Promise.all(instance.promises);

    // Fetch request #2
    savedProps.fetch();
    await Promise.all(instance.promises);

    // Fetch request #3
    savedProps.fetch();
    await Promise.all(instance.promises);

    // All promises are resolved
    expect(instance.promises.length).toEqual(0);

    // Would have been 5 if request 1 was not ignored
    expect(mockChildren.mock.calls.length).toBe(7);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading request 1
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 1 returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: responseData1,
      request: {},
      response: {}
    });

    // Loading request 2
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 2 returned
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: false,
      data: [...responseData1, ...responseData2],
      request: {},
      response: {}
    });

    // Loading request 3
    expect(mockChildren.mock.calls[5][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 3 returned
    expect(mockChildren.mock.calls[6][0]).toMatchObject({
      loading: false,
      data: [...responseData1, ...responseData2, ...responseData3],
      request: {},
      response: {}
    });

    // All promises have been processed / removed
    expect(instance.promises.length).toEqual(0);

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports clearing data before "onDataChange" is called', async () => {
    const url = 'http://localhost';
    const responseData1 = [1, 2, 3];
    fetchMock.once(url, responseData1);

    const responseData2 = [4, 5, 6];
    fetchMock.once(url, responseData2);

    const responseData3 = [7, 8, 9];
    fetchMock.once(url, responseData3);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const handleOnDataChange = (newData, currentData = []) => [
      ...currentData,
      ...newData
    ];

    const wrapper = mount(
      <Fetch url={url} onDataChange={handleOnDataChange}>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();

    // Fetch request #2
    savedProps.fetch();

    // Fetch request #3
    savedProps.fetch(url, null, { ignorePreviousData: true });

    // Wait for all requests to return before asserting
    await Promise.all(instance.promises);

    // All promises are resolved
    expect(instance.promises.length).toEqual(0);

    // Would have been 5 if request 1 was not ignored
    expect(mockChildren.mock.calls.length).toBe(7);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading request 1
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Loading request 2
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Loading request 3
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 1 returned
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: false,
      data: responseData1,
      request: {},
      response: {}
    });

    // Request 2 returned
    expect(mockChildren.mock.calls[5][0]).toMatchObject({
      loading: false,
      data: [...responseData1, ...responseData2],
      request: {},
      response: {}
    });

    // Request 3 returned
    expect(mockChildren.mock.calls[6][0]).toMatchObject({
      loading: false,
      data: responseData3,
      request: {},
      response: {}
    });

    // All promises have been processed / removed
    expect(instance.promises.length).toEqual(0);

    expect(fetchMock.called(url)).toBe(true);
  });

  it('supports clearing data', async () => {
    const url = 'http://localhost';
    const responseData1 = [1, 2, 3];
    fetchMock.once(url, responseData1);

    const responseData2 = [4, 5, 6];
    fetchMock.once(url, responseData2);

    const responseData3 = [7, 8, 9];
    fetchMock.once(url, responseData3);

    const responseData4 = [10, 11, 12];
    fetchMock.once(url, responseData4);

    const responseData5 = [13, 14, 15];
    fetchMock.once(url, responseData5);

    let savedProps = null;

    const mockChildren = jest.fn(props => {
      savedProps = props;
      return <div />;
    });

    const handleOnDataChange = (newData, currentData = []) => [
      ...currentData,
      ...newData
    ];

    const wrapper = mount(
      <Fetch url={url} onDataChange={handleOnDataChange}>
        {mockChildren}
      </Fetch>
    );
    const instance = wrapper.instance();
    await Promise.all(instance.promises);

    // Fetch request #2
    savedProps.fetch();
    await Promise.all(instance.promises);

    // Fetch request #3
    savedProps.fetch();
    await Promise.all(instance.promises);

    savedProps.clearData();

    // Fetch request #4
    savedProps.fetch();
    await Promise.all(instance.promises);

    // Fetch request #5
    savedProps.fetch();
    await Promise.all(instance.promises);

    // All promises are resolved
    expect(instance.promises.length).toEqual(0);

    expect(mockChildren.mock.calls.length).toBe(12);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading request 1
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 1 returned
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data: responseData1,
      request: {},
      response: {}
    });

    // Loading request 2
    expect(mockChildren.mock.calls[3][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 2 returned
    expect(mockChildren.mock.calls[4][0]).toMatchObject({
      loading: false,
      data: [...responseData1, ...responseData2],
      request: {},
      response: {}
    });

    // Loading request 3
    expect(mockChildren.mock.calls[5][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 3 returned
    expect(mockChildren.mock.calls[6][0]).toMatchObject({
      loading: false,
      data: [...responseData1, ...responseData2, ...responseData3],
      request: {},
      response: {}
    });

    // Data cleared
    expect(mockChildren.mock.calls[7][0]).toMatchObject({
      loading: false,
      data: undefined,
      request: {},
      response: {}
    });

    // Loading request 4
    expect(mockChildren.mock.calls[8][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 4 returned
    expect(mockChildren.mock.calls[9][0]).toMatchObject({
      loading: false,
      data: [...responseData4],
      request: {},
      response: {}
    });

    // Loading request 5
    expect(mockChildren.mock.calls[10][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Request 5 returned
    expect(mockChildren.mock.calls[11][0]).toMatchObject({
      loading: false,
      data: [...responseData4, ...responseData5],
      request: {},
      response: {}
    });

    // All promises have been processed / removed
    expect(instance.promises.length).toEqual(0);

    expect(fetchMock.called(url)).toBe(true);
  });
});

describe('middleware', () => {
  it('supports interceptor / middlware', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    // const mockInterceptor = jest.fn();
    // mockChildren.mockReturnValue(<div />)

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const middleware = fetchProps => mockChildren;

    const wrapper = mount(<Fetch url={url}>{middleware}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });
});

describe('middleware', () => {
  it('supports interceptor / middlware', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    // const mockInterceptor = jest.fn();
    // mockChildren.mockReturnValue(<div />)

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const middleware = fetchProps => mockChildren;

    const wrapper = mount(<Fetch url={url}>{middleware}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });
  // TODO: Add test for conditional returning based on request.status (ex. 401 returns login, 200 returns `children`)

  it('supports multiple interceptors / middlwares', async () => {
    const url = 'http://localhost';
    const data = { hello: 'world' };
    fetchMock.once(url, data);

    const mockChildren = jest.fn();
    mockChildren.mockReturnValue(<div />);

    const middleware = fetchProps => fetchProps => mockChildren;

    const wrapper = mount(<Fetch url={url}>{middleware}</Fetch>);
    const instance = wrapper.instance();

    await Promise.all(instance.promises);

    // Once for initial, once for loading, and once for response
    expect(mockChildren.mock.calls.length).toBe(3);

    // Initial state
    expect(mockChildren.mock.calls[0][0]).toMatchObject({
      loading: null,
      request: {}
    });

    // Loading...
    expect(mockChildren.mock.calls[1][0]).toMatchObject({
      loading: true,
      request: {}
    });

    // Data loaded
    expect(mockChildren.mock.calls[2][0]).toMatchObject({
      loading: false,
      data,
      request: {},
      response: {}
    });

    expect(fetchMock.called(url)).toBe(true);
  });
});

// TODO: Having difficulting testing/mocking this
/*it('can use onChange with setState to control rendering instead of child function', async () => {
  const data = { hello: 'world' };
  fetchMock.once('*', data);

  let wrapper = null;

  // TODO: This is being called before `wrapper` is set.
  const mockOnChange = jest.fn(props => {
    console.log('mockOnChange')
    if (wrapper) {
      console.log('mockOnChange, setting state', props)
      wrapper.setState({ loading: props.loading })
    }
  });

  const mockChildren = jest.fn();
  mockChildren.mockReturnValue(<div />);

  console.log('before mount')
  wrapper = mount(
    <Fetch url='http://localhost' onChange={mockOnChange}>
      <div></div>
    </Fetch>
  );
  console.log('after mount')
  const instance = wrapper.instance();
  const promises = instance.promises;

  console.log('before promise resolves')
  await Promise.all(promises);

  expect(mockOnChange.mock.calls.length).toBe(3);
  expect(mockChildren.mock.calls.length).toBe(3);

  // // Initial state
  expect(mockOnChange.mock.calls[0][0]).toMatchObject({ loading: null });

  // // Loading...
  expect(mockOnChange.mock.calls[1][0]).toMatchObject({ loading: true, request: {} });

  // // Data loaded
  expect(mockOnChange.mock.calls[2][0]).toMatchObject({ loading: false, data, request: {}, response: {} });

  expect(fetchMock.called('*')).toBe(true);
});*/

// TODO: onChange is called before render
// TODO: Create test to verify calling "setState" in "onChange" prop is supported

// TODO: Test changing props updates `request` passed
// TODO: Make sure all errors are not swallowed (just fetch-related like CORS issue)

// Restore ISO-8601 date strings as `Date` objects when parsing JSON
const DATETIME_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/; // yyyy-mm-ddThh:mm:ssZ
function reviver(key, value) {
  if (typeof value === 'string' && DATETIME_FORMAT.test(value)) {
    // datetime in UTC
    return new Date(value);
  }

  return value;
}
