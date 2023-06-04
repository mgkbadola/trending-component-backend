const mongo = require('mongodb');

module.exports = {
    fetchTrending: async (req, res) => {
        var resObj = { articleList: [], message: "", count: 0 };
        const client = new mongo.MongoClient(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_CLUSTER}.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`);
        try {
            await client.connect();

            var visit_id = req.query.visit_id;
            var article_id = req.query.article_id;

            if (isNaN(parseInt(visit_id)) || isNaN(parseInt(article_id)))
                throw Error("Fault in visit_id or article_id!");

            const db = client.db();
            await db.command({ ping: 1 });

            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).getTime();
            const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).getTime();

            const userData = await db.collection('userActivityRecords')
                .aggregate([
                    {
                        $match: {
                            visit_id: { $eq: parseInt(visit_id) }
                        }
                    },
                    {
                        $lookup: {
                            from: 'articleEntityRecords',
                            localField: 'article_id',
                            foreignField: 'article_id',
                            as: 'article',
                        },
                    },
                    {
                        $unwind: '$article',
                    },
                    {
                        $lookup: {
                            from: 'userEntityRecords',
                            localField: 'visit_id',
                            foreignField: 'visit_id',
                            as: 'user',
                        },
                    },
                    {
                        $unwind: '$user',
                    },
                    {
                        $project: {
                            'article.category_id': 1,
                            'user.region': 1
                        },
                    }
                ]).toArray();
            if (userData.length == 0)
                throw Error("No details found for the given visit_id!");

            const batchData = await db.collection('userActivityRecords')
                .aggregate([
                    {
                        $match: {
                            last_updated_on: { $gte: twoMinutesAgo },
                            visit_id: { $ne: parseInt(visit_id) }
                        },
                    },
                    {
                        $lookup: {
                            from: 'articleEntityRecords',
                            localField: 'article_id',
                            foreignField: 'article_id',
                            as: 'article',
                        },
                    },
                    {
                        $unwind: '$article',
                    },
                    {
                        $match: {
                            'article.created_on': { $gte: fiveDaysAgo },
                        },
                    },
                    {
                        $lookup: {
                            from: 'userEntityRecords',
                            localField: 'visit_id',
                            foreignField: 'visit_id',
                            as: 'user',
                        },
                    },
                    {
                        $unwind: '$user',
                    },
                    {
                        $project: {
                            'article.article_id': 1,
                            'article.category_id': 1,
                            'article.heading': 1,
                            'article.created_on': 1,
                            'article.cdn_slug': 1,
                            'article.article_slug': 1,
                            'user.region': 1
                        },
                    }
                ]).toArray();
            
            resObj.count = batchData.length;
            var articlesByVisitCount = []
            const batchDataWithCategoryFilter = batchData.filter(i => i.article.category_id === userData[0].article.category_id)
            if (batchDataWithCategoryFilter.length < 3) {
                articlesByVisitCount = performCountGroupBy(batchData);
            }
            else {
                const categorisedBatchDataWithLocationFilter = batchDataWithCategoryFilter.filter(i => i.user.region === userData[0].user.region)
                if (categorisedBatchDataWithLocationFilter.length < 3) {
                    articlesByVisitCount = performCountGroupBy(batchDataWithCategoryFilter);
                }
                else {
                    articlesByVisitCount = performCountGroupBy(categorisedBatchDataWithLocationFilter)
                }
            }
            resObj.articleList = articlesByVisitCount;
            resObj.message = "success";
        } catch (err) {
            resObj.message = err.toString()
        } finally {
            await client.close()
        }
        res.json(resObj)
    },
    modifyBehaviour: async (req, res) => {
        var resObj = { message: "" }
        const client = new mongo.MongoClient(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_CLUSTER}.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`);
        var reqObj = req.query
        try {
            const visit_id = reqObj.visit_id
            const article_id = reqObj.article_id
            const isJob = reqObj.isJob
            if (visit_id !== undefined && article_id !== undefined) {
                if (isNaN(parseInt(visit_id)) || isNaN(parseInt(article_id)))
                    throw Error("Fault in visit_id or article_id!");
            }
            else if (visit_id === undefined && article_id === undefined) {
                if (isNaN(parseInt(isJob)) || parseInt(isJob) !== 1) {
                    throw Error("Both visit_id and article_id has not been supplied!")
                }
            }
            else {
                throw Error("Either visit_id or article_id has not been supplied!")
            }
            await client.connect()
            const db = client.db();
            await db.command({ ping: 1 });

            const collection = db.collection('userActivityRecords')
            const articles = await db.collection('articleEntityRecords').distinct('article_id');
            const users = await db.collection('userEntityRecords').distinct('visit_id');

            if (visit_id === undefined) {
                var maxUpdateQueries = 1 + Math.floor(Math.random() * users.length)
                while (maxUpdateQueries--)
                    await collection.updateOne({ visit_id: users.selectRandom() }, { $set: { article_id: articles.selectRandom(), last_updated_on: Date.now() } })
                resObj.message = "Queued up for updation successfully."
            }
            else {
                if (!articles.includes(article_id))
                    throw Error("No details found for the given article_id!");
                if (!users.includes(visit_id) == 0)
                    throw Error("No details found for the given article_id!");
                await collection.updateOne({ visit_id: visit_id }, { $set: { article_id: article_id, last_updated_on: Date.now() } })
                resObj.message = "Queued up for updation successfully."
            }
        } catch (err) {
            resObj.message = `Queueing up for updation failed! ${err}`
        } finally {
            await client.close()
        }
        res.json(resObj)
    },
    //Internal
    addArticle: async (req, res) => {
        var resObj = { message: "" }
        const client = new mongo.MongoClient(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_CLUSTER}.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`);
        try {
            await client.connect()
            const db = client.db();
            await db.command({ ping: 1 });
            const art_slug = ['nba', 'boxing', 'f1', 'nascar', 'ufc', 'esports', 'wrestling', 'nfl', 'tennis', 'golf', 'baseball', 'soccer']
            const category_id = Math.floor(Math.random() * 12)
            const cdn_slug = category_id % 2 === 0 ? "/ffffff/000000" : "/000000/ffffff";
            await db.collection('articleEntityRecords').insertOne({
                article_id: Math.floor(Date.now() / 1000000),
                heading: "A very original headline",
                subheading: "An equally unique sub-headline",
                author: "A hardworking author",
                category_id: category_id,
                article_slug: art_slug[category_id],
                cdn_slug: cdn_slug,
                created_on: Date.now()
            })
            resObj.message = "Queued up for insertion successfully."

        } catch (err) {
            resObj.message = `Queueing failed: ${err}`
        } finally {
            await client.close()
        }
        res.json(resObj)
    },
    addUser: async (req, res) => {
        var resObj = { message: "" }
        const client = new mongo.MongoClient(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_CLUSTER}.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`);
        try {
            await client.connect()
            const db = client.db();
            await db.command({ ping: 1 });
            const visit_id = 2 * Math.floor(Date.now() / 1000000)
            const regions = ['NA', 'EU', 'SEA']
            const campaigns = ['vanmoof_promo', 'el_fuego', 'pinto__di_blu']
            const sources = ['internal', 'organic', 'twitter', 'facebook']
            const articles = await db.collection('articleEntityRecords').find({}, { fields: { article_id: 1 } }).toArray();
            db.collection('userEntityRecords').insertOne({
                visit_id: visit_id,
                utm_source: Math.random() >= 0.5 ? null : sources.selectRandom(),
                utm_campaign: Math.random() >= 0.5 ? null : campaigns.selectRandom(),
                ip_address: '127.0.0.1',
                created_on: Date.now(),
                region: regions.selectRandom()
            }).then((success) => {
                db.collection('userActivityRecords').insertOne({
                    visit_id: visit_id,
                    article_id: articles.selectRandom(),
                    last_updated_on: Date.now()
                }).then((success) => { resObj.message = "Queued up for insertion successfully." }).catch((err) => { resObj.message = `Queueing failed: ${err}` })
            }).catch((err) => { resObj.message = `Queueing failed: ${err}` })
        } catch (err) {
            resObj.message = `Queueing failed: ${err}`
        } finally {
            await client.close()
        }
        res.json(resObj)
    }
}

function performCountGroupBy(batchData) {
    var visitCountByArticle = batchData.reduce((map, entry) => {
        const articleId = entry.article.article_id;
        if (map.has(articleId)) {
            map.set(articleId, map.get(articleId) + 1)
        }
        else {
            map.set(articleId, 1)
        }
        return map;
    }, new Map());
    var sortedBunch = Array.from(visitCountByArticle.entries()).sort((a, b) => b[1] - a[1])
    sortedBunch = sortedBunch.map(i => i[0])
    if (sortedBunch.length > 5)
        sortedBunch = sortedBunch.slice(0, 5)
    var curatedList = []
    for(let articleId of sortedBunch)
        curatedList.push(batchData.find(d => d.article.article_id === articleId).article)
    return curatedList;
}

Array.prototype.selectRandom = function () { return this[Math.floor(Math.random() * this.length)] }