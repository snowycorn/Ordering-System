import "@testing-library/jest-dom";

const mockRouter = {
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
  push: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
};

let mockPathname = "/";
let mockSearchParams = new URLSearchParams();

global.__NEXT_NAVIGATION_MOCKS__ = {
  router: mockRouter,
  reset() {
    Object.values(mockRouter).forEach((mock) => mock.mockClear());
    mockPathname = "/";
    mockSearchParams = new URLSearchParams();
  },
  setPathname(pathname) {
    mockPathname = pathname;
  },
  setSearchParams(params) {
    mockSearchParams = params instanceof URLSearchParams
      ? params
      : new URLSearchParams(params);
  },
};

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

beforeEach(() => {
  global.__NEXT_NAVIGATION_MOCKS__.reset();
  jest.clearAllMocks();
});
