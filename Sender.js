'use strict'
/**
 * Класс-транспорт для отправки сообщений с событиями логов в MQ
 */

const Transport = require('fayulogger/Transport');
const amqplib = require('amqplib');
const uuid = require('uuid/v1');

/**
 * Класс для отправки логов в MQ
 */
class Sender extends Transport {
    /**
     * Конструктор
     * @param {String} name Название транспорта
     * @param {Object} options параметры подключения к MQ
     */
    constructor(name, options) {
        super(name);
        //Подключение
        this.__connection = null;
        //Канал
        this.__channel = null;
        //Обменник
        this.__exchange = null;
        
        this.__hostname = options && options.hostname ? options.hostname : 'localhost';//Адрес сервера
		this.__port = options && options.port ? options.port : 5672;//Порт сервера
		this.__username = options && options.username ? options.username : 'guest';//Логин подключения
		this.__password = options && options.password ? options.password : 'guest';//Пароль подключения
		this.__heartbeat = options && options.heartbeat ? options.heartbeat : 30;//Проверка соединения
		this.__frameMax = options && options.frameMax ? options.frameMax : 0;//Размер фрейма
		this.__locale = options && options.locale ? options.locale : 'en_US';//Язык по умолчанию
		this.__vhost = options && options.vhost ? options.vhost : '/';//Путь до экземпляра
        //this.__queueName = options && options.queue ? options.queue : `server-rpc-${uuid()}`;//Название очереди сервера
        this.__exchangeName = options && options.exchange ? options.exchange : 'logs';//Обменник для логов
		this.__prefetch = options && options.prefetch && typeof(options.prefetch) == 'number' ? options.prefetch : 3;
		this.__reconnect = options && options.reconnect && typeof(options.reconnect) == 'boolean' ? options.reconnect : false;//Переподключаться, если был разрыв соединения
    }

    /**
     * Подготовка сообщения (генерация id, установка текущей даты/времени и т.д.)
     * @param {Object} msg Событие/лог
     * @returns Возвращает подготовленные данные для отправки
     */
    __prepareMessage(msg) {
        return {
            id: uuid(),
            dt: new Date(),
            remoteName: msg.name,
            message: msg.message
        }
    }

    /**
     * Отправка сообщения в очередь-обменник
     * @param {String} level Уровень сообшения (лога)
     * @param {Object} msg Сообщение
     */
    __sendEvent(level, msg) {
        if(this.__channel) {
            this.__channel.publish(this.__exchangeName, level, new Buffer(JSON.stringify(this.__prepareMessage(msg))));
        }
    }

    /**
     * Событие отладки
     * @param {Object} msg Сообщение
     */
    __onDebug(msg) {
        this.__sendEvent('debug', msg);
    }

    /**
     * Событие информации
     * @param {Object} msg Сообщение
     */
    __onInfo(msg) {
        this.__sendEvent('info', msg);
    }

    /**
     * Событие предупреждения
     * @param {Object} msg Сообщение
     */
    __onWarn(msg) {
        this.__sendEvent('warn', msg);
    }

    /**
     * Событие серьезного предупреждения
     * @param {Object} msg Сообщение
     */
    __onSevere(msg) {
        this.__sendEvent('severe', msg);
    }

    /**
     * Событие ошибки
     * @param {Object} msg Сообщение
     */
    __onError(msg) {
        this.__sendEvent('error', msg);
    }

    /**
     * Событие фатальной ошибки
     * @param {Object} msg Сообщение
     */
    __onFatal(msg) {
        this.__sendEvent('fatal', msg);
    }

    /**
     * Подключение к MQ
     */
    async connect() {
        try {
            this.__connection = await amqplib.connect({
                protocol: 'amqp',
				hostname: this.__hostname,
				port: this.__port,
				username: this.__username,
				password: this.__password,
				locale: this.__locale,
				frameMax: this.__frameMax,
				heartbeat: this.__heartbeat,
				vhost: this.__vhost
            })
        } catch(e) {
            await this.__stop();
            throw e;
        }
        try {
			this.__channel = await this.__connection.createChannel();
			this.__channel.prefetch(this.__prefetch);
			this.__channel.on('close', () => {
				//TODO если канал закрыт
			});
			this.__channel.on('error', (err) => {
				console.error(err);
				//TODO если получена ошибка канала
			});
			this.__channel.on('return', (msg) => {
				//console.log(msg.content);
				//TODO если возвращено сообщение, которое не удалось отправить в очередь
			});
			this.__channel.on('drain', () => {
				//TODO Like a stream.Writable, a channel will emit 'drain', if it has previously returned false from #publish or #sendToQueue, once its write buffer has been emptied (i.e., once it is ready for writes again).
			});
		}catch(e){
			await this.__stop();
			throw e;
        }
        
        try {
            this.__channel.assertExchange(this.__exchangeName, 'direct', {durable: false});
        } catch(e) {
            await this.__stop();
            throw e;
        }
        return true;
    }

    /**
     * Закрытие транспорта
     */
    close() {
        this.__stop();
        this.super();
    }

    /**
     * Отключение от MQ
     */
    async __stop() {
        this.__channel = null;
        try {
            if(this.__connection != null) {
                this.__connection.close();
            }
        } finally {
            this.__connection = null;
        }
    }
}

module.exports = Sender;