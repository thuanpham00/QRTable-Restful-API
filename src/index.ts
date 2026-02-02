// Import the framework and instantiate it
import envConfig, { API_URL } from '@/config'
import { errorHandlerPlugin } from '@/plugins/errorHandler.plugins'
import validatorCompilerPlugin from '@/plugins/validatorCompiler.plugins'
import accountRoutes from '@/routes/account.route'
import authRoutes from '@/routes/auth.route'
import fastifyAuth from '@fastify/auth'
import fastifyCookie from '@fastify/cookie'
import fastifyHelmet from '@fastify/helmet'
import fastifySocketIO from 'fastify-socket.io'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import path from 'path'
import { createFolder } from '@/utils/helpers'
import mediaRoutes from '@/routes/media.route'
import staticRoutes from '@/routes/static.route'
import dishRoutes from '@/routes/dish.route'
import testRoutes from '@/routes/test.route'
import { initOwnerAccount } from '@/controllers/account.controller'
import tablesRoutes from '@/routes/table.route'
import guestRoutes from '@/routes/guest.route'
import orderRoutes from '@/routes/order.route'
import { socketPlugin } from '@/plugins/socket.plugins'
import indicatorRoutes from '@/routes/indicator.route'
import autoRemoveRefreshTokenJob from '@/jobs/autoRemoveRefreshToken.job'
import categoryRoutes from '@/routes/category.route'
import menusRoutes from '@/routes/menu.route'
import ingredientRoutes from '@/routes/ingredient.route'
import guestCallRoutes from '@/routes/guest-call.route'

const fastify = Fastify({
  logger: false
})

// Run the server!
const start = async () => {
  try {
    createFolder(path.resolve(envConfig.UPLOAD_FOLDER))
    autoRemoveRefreshTokenJob()
    const whitelist = ['*']
    fastify.register(cors, {
      origin: whitelist, // Cho phép tất cả các domain gọi API
      credentials: true // Cho phép trình duyệt gửi cookie đến server
    })

    fastify.register(fastifyAuth, {
      defaultRelation: 'and'
    })
    fastify.register(fastifyHelmet, {
      crossOriginResourcePolicy: {
        policy: 'cross-origin' // Cho phép load resources từ domain khác
      }
    })
    fastify.register(fastifyCookie) // Cho phép đọc/ghi cookie
    fastify.register(validatorCompilerPlugin) // // Cho phép đọc/ghi cookie
    fastify.register(errorHandlerPlugin) // xử lý lỗi chung
    fastify.register(fastifySocketIO, {
      cors: {
        origin: envConfig.CLIENT_URL // Chỉ cho phép client URL kết nối
      }
    })
    fastify.register(socketPlugin) // Custom socket logic (auth, rooms)
    fastify.register(authRoutes, {
      prefix: '/auth'
    })
    fastify.register(accountRoutes, {
      prefix: '/accounts'
    })
    fastify.register(mediaRoutes, {
      prefix: '/media'
    })
    fastify.register(staticRoutes, {
      prefix: '/static'
    })
    fastify.register(dishRoutes, {
      prefix: '/dishes'
    })
    fastify.register(ingredientRoutes, {
      prefix: '/ingredients'
    })
    fastify.register(categoryRoutes, {
      prefix: '/dish-categories'
    })
    fastify.register(menusRoutes, {
      prefix: '/menus'
    })
    fastify.register(tablesRoutes, {
      prefix: '/tables'
    })
    fastify.register(orderRoutes, {
      prefix: '/orders'
    })
    fastify.register(testRoutes, {
      prefix: '/test'
    })
    fastify.register(indicatorRoutes, {
      prefix: '/indicators'
    })
    fastify.register(guestRoutes, {
      prefix: '/guest'
    })
    fastify.register(guestCallRoutes, {
      prefix: '/guest-calls'
    })
    await initOwnerAccount()
    await fastify.listen({
      port: envConfig.PORT,
      host: envConfig.DOCKER ? '0.0.0.0' : 'localhost'
    })
    console.log(`Server đang chạy: ${API_URL}`)
  } catch (err) {
    console.log(err)
    fastify.log.error(err)
    process.exit(1) //  // Thoát nếu start fail
  }
}
start()
