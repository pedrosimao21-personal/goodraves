import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { createServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function run() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  })

  try {
    const TopDJs = (await vite.ssrLoadModule('/src/pages/TopDJs.jsx')).default
    const ArtistDetail = (await vite.ssrLoadModule('/src/pages/ArtistDetail.jsx')).default
    const ReactDOMServer = await vite.ssrLoadModule('react-dom/server')
    const React = await vite.ssrLoadModule('react')
    const ReactRouter = await vite.ssrLoadModule('react-router-dom')
    const { UserDataProvider } = await vite.ssrLoadModule('/src/context/UserDataContext.jsx')

    console.log("Modules loaded...")
    
    const renderApp = (Component, initialEntries) => {
      return ReactDOMServer.renderToString(
        React.createElement(
          ReactRouter.MemoryRouter,
          { initialEntries },
          React.createElement(
            UserDataProvider,
            null,
            React.createElement(
              ReactRouter.Routes,
              null,
              React.createElement(ReactRouter.Route, {
                path: "*",
                element: React.createElement(Component, null)
              })
            )
          )
        )
      )
    }

    try {
      console.log('Rendering TopDJs...')
      const html1 = renderApp(TopDJs, ['/top-djs'])
      console.log('TopDJs HTML length:', html1.length)
    } catch (e) {
      console.error('Error rendering TopDJs:', e)
    }

    try {
      console.log('Rendering ArtistDetail...')
      const html2 = renderApp(ArtistDetail, ['/artist/test-artist?id=123'])
      console.log('ArtistDetail HTML length:', html2.length)
    } catch (e) {
      console.error('Error rendering ArtistDetail:', e)
    }

  } catch (e) {
    console.error('Setup error:', e)
  }

  vite.close()
}

run()
