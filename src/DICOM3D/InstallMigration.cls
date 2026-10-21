/// Exact051 FileCopy retirement; no renderer, source data or permission changes.
Class DICOM3D.InstallMigration Extends %RegisteredObject
{

/// WHY: IPM per-file Activate leaves obsolete051 names behind on upgrade.
/// BOUNDARY: only204 published051 paths/old hashes; privileged maintenance install.
/// INVARIANT: preflight all before any deletion; current375 targets are disjoint.
/// EVIDENCE: scripts/retired-filecopy-051.json and exact native release receipt.
/// REGRESSION: filesystem deletion is not transactional; no concurrent CSP writer.
ClassMethod Retire051(root As %String) As %Status [ Language = python ]
{
    import hashlib, json, os, stat
    import iris

    targets = {
        "assets/abs-BaKHBYWX.js": {
            "bytes": 328,
            "sha256": "0a6e432d6c0ea1cf249dc80c94e1a89cb147af63243e6b96c6e3531d5eda6c42"
        },
        "assets/acos-Ct9OxGBs.js": {
            "bytes": 338,
            "sha256": "f7293c45d83033a695cf62b1f24e838fee1e8c410e1143eeafa80580a3e6758a"
        },
        "assets/acosh-CABXZoqM.js": {
            "bytes": 340,
            "sha256": "9a9d157f22983d20c132c19d31e2da769f8c53f155c2fa5826d7e9bc3769ec33"
        },
        "assets/add-DcBHioU9.js": {
            "bytes": 366,
            "sha256": "24f75ec585c906a1138ba96292d273fbb1c84966daecb2042792954471c43b52"
        },
        "assets/angle-between-ctfmjhS_.js": {
            "bytes": 401,
            "sha256": "f7f0f42338306ad855a907b78d6a45cc164630dc67773177322a4f458cfb13c9"
        },
        "assets/animation-group-B5cxxtVn.js": {
            "bytes": 6563,
            "sha256": "1a016d0cd46399f5814ba1c4cf8e632778e748f98cddb5e631afdaccaf36f327"
        },
        "assets/animation-pointer-C9p98281.js": {
            "bytes": 3789,
            "sha256": "f2de8b31f2de68fb98ea441c969a43c7b0c496e1e8c2091bc0c8b682c8d839b5"
        },
        "assets/animation-pointer-ext-BppPkDp_.js": {
            "bytes": 4463,
            "sha256": "a9728d59ac6bf17153a7d9a0630a9d3b8540ecc1a8fe3325e66b751737490660"
        },
        "assets/asin-B76Wg78w.js": {
            "bytes": 338,
            "sha256": "f72f360b310104a1e763636cdda12984b207d0e495cd0637168db792cd0c807a"
        },
        "assets/asinh-CApkjYgt.js": {
            "bytes": 340,
            "sha256": "da2a8997f7b2644af86cc329a076ddb831734f6d101458ff6c68c22e994ad704"
        },
        "assets/atan-BV2WOdkM.js": {
            "bytes": 338,
            "sha256": "8cdf499a317ae9c7cc8fc71d9d5c8004a713b2ef110e6e9bfcbe21744f017aef"
        },
        "assets/atan2-C74pzpN4.js": {
            "bytes": 370,
            "sha256": "95b43b61124c574194c828e1b59b711195a7cd62800dfcd39d69b7b0cd7a1e5e"
        },
        "assets/atanh-B_QzeiVx.js": {
            "bytes": 340,
            "sha256": "892767ff96e018b36b73b902650f0a62f5be32deb253b1d7ff79e5cf2d2cdda4"
        },
        "assets/axis-angle-from-quaternion-Czu1-ReU.js": {
            "bytes": 488,
            "sha256": "a1edde9e22bb167af7402823a7805f944fa10b6456906d39b5d2c584c7887840"
        },
        "assets/bitwise-and-CQwsXUho.js": {
            "bytes": 380,
            "sha256": "57f2f282b6f97b0aa21bc2a6fbd0c6b42272fb705196125d97ca6098e0ae107e"
        },
        "assets/bitwise-left-shift-Cnf7u1Pz.js": {
            "bytes": 392,
            "sha256": "0249907666a5d272bf732029990de02173f1eed19dc9a96c7a92bfb7d8f04b8f"
        },
        "assets/bitwise-not-DcWSfl9v.js": {
            "bytes": 351,
            "sha256": "efc9f2ce70692d8a9c4a9b2f2b6579e938f0f94d6cc6f9f00f690a690df85424"
        },
        "assets/bitwise-or-D0Ep-E-O.js": {
            "bytes": 379,
            "sha256": "6601c5298c371aae9be81b103786551d1b381b0586a8c3ff2d7db6ea5b350ba2"
        },
        "assets/bitwise-right-shift-DyoaMjvM.js": {
            "bytes": 394,
            "sha256": "f3b63913d818087f8a4f4f9c7415b1b4a23841482be4217523d6848634b4b079"
        },
        "assets/bitwise-xor-JCOqrs3K.js": {
            "bytes": 381,
            "sha256": "9f3fdd9e81fdedc93533875a3fc06a79703d0079a5741193c2b120d4bc9ed390"
        },
        "assets/bone-control-BZezK76m.js": {
            "bytes": 3680,
            "sha256": "96da3a79421d0de787d135ea015b54a52b6db02e2343a0fd23d0379a608284fb"
        },
        "assets/boolean-to-float-9UbR8tah.js": {
            "bytes": 318,
            "sha256": "67ee59a478de812e6470cda2c5621f19a4fa9b6c8bffe8e896eed2e1c6755192"
        },
        "assets/boolean-to-int-DqQ5BYcg.js": {
            "bytes": 325,
            "sha256": "cf97956a1700acb88fc4130fe89e950c83687603220b5987482e4672f449bc26"
        },
        "assets/branch-1rKGP8tI.js": {
            "bytes": 364,
            "sha256": "ca76eaf66fa49805a495569ca710841dabf2b63ad658d0534ec9182532591d32"
        },
        "assets/camera-tKlHcyjL.js": {
            "bytes": 1486,
            "sha256": "ec692c8cd86f3efc8b3c5fd9b604284e8ba8f2adcf02b373b63f7d26c211a541"
        },
        "assets/cancel-delay-C8oMbQ0w.js": {
            "bytes": 534,
            "sha256": "9834b36488685dbedfff77c3015b278dde0585f727c5ef33eecc2bbf7e1724ab"
        },
        "assets/ceil-DZJyCqFP.js": {
            "bytes": 338,
            "sha256": "576718c020d66f6516eeabd27d5bf530dd76b82031c94b2c0ee1d0e5aa9c6295"
        },
        "assets/clamp-2EZUnTOC.js": {
            "bytes": 400,
            "sha256": "59b9375f476a593551679b4a3bfd199cbdcdcfbe3707d7c4cbeeb5138b626490"
        },
        "assets/combine-matrix-D-Rj3n-8.js": {
            "bytes": 478,
            "sha256": "256fe0e3fde9afa80bf8c47dc99f70e9db764a60b6fd9acf1249454759023f99"
        },
        "assets/combine-matrix2d-DNusO80P.js": {
            "bytes": 482,
            "sha256": "2a4f6125fec5ba25c2eec206ee45b37fcc1a6bda24242202fe876c21b48da139"
        },
        "assets/combine-matrix3d-DRv4-cq7.js": {
            "bytes": 482,
            "sha256": "15ef3cd625a42b76be43cd8554bb969e1ef67004bb0a411db87ff47bbe639003"
        },
        "assets/combine2-BkpvPjan.js": {
            "bytes": 392,
            "sha256": "ae935d09f3558bfb60361d752ee7b4d57b48c46b72aae8f2df1ba21a9a6a130d"
        },
        "assets/combine3-DZ-B1wFJ.js": {
            "bytes": 425,
            "sha256": "d018a3d1b967c443f72f30ec41094dd09bc7b81f25d3ab7e0270d08b455bf4dc"
        },
        "assets/combine4-BJsDOq3u.js": {
            "bytes": 458,
            "sha256": "5ee08da8fed4099c9be77557fc46e4d666240804f4dc1bc79a9b48e97cc78b27"
        },
        "assets/compute-texture-binding-DsH0cWZ1.js": {
            "bytes": 12785,
            "sha256": "7b7185f2b2fb95a467b1fc9a2bf2733a771f505dca9441456647c987e89bf5a4"
        },
        "assets/conditional-D23VLTv9.js": {
            "bytes": 404,
            "sha256": "f23ac3af59ecaf8030392c564de5cc73c2ab743c5736318bbb1a453cfa1405c6"
        },
        "assets/console-log-0SLWZmAz.js": {
            "bytes": 977,
            "sha256": "0c895fa867d0166d628f72f375fa6046a471a8a65f30ea45a5a4ca7c4595da25"
        },
        "assets/constant-e-DHMO0C-J.js": {
            "bytes": 238,
            "sha256": "b581599d90d0a8912d2f235927a0910ad585c39a77cf7ea221b59373f71e7b5e"
        },
        "assets/constant-inf-CayBhIrK.js": {
            "bytes": 239,
            "sha256": "84d6c88f07731c7100a9d331b34fd167b7c0b9553f721926d97ec53eb49d690b"
        },
        "assets/constant-juo4H4WG.js": {
            "bytes": 266,
            "sha256": "86597819df26657094c0d58094d40894bec60b1d7286eb5ca073534ce3b1c726"
        },
        "assets/constant-nan-Bit3pyPX.js": {
            "bytes": 239,
            "sha256": "869270013cd604fb96197150b9c7ab1e0f89b3e8384f250f58c33f27c2bc683d"
        },
        "assets/constant-pi-BqagFBoD.js": {
            "bytes": 241,
            "sha256": "1685f4b1363819c48ad5c5cf8d9df8acb1ed57e9a4e34095bb8e81d0fedcb1b4"
        },
        "assets/constant-tau-NbTf3qzh.js": {
            "bytes": 245,
            "sha256": "0e1d92d319fe409deb3fde2ae3cd6f374266d688bebb01bb7b0352a6300cfe70"
        },
        "assets/cos-BDH7CLzb.js": {
            "bytes": 336,
            "sha256": "f15fd8c0d7f3fbca1f93ba190b1c9f496eaad24cd8d9d0391325fcf1229a2750"
        },
        "assets/cosh-kqYv_od2.js": {
            "bytes": 338,
            "sha256": "dadf418d24036a18d506c60c096637721b72034f19242a5e4eb9eb307ce696cb"
        },
        "assets/cross-DGtDL5he.js": {
            "bytes": 374,
            "sha256": "827ba6441620e690f5af60136d1eacbac0f8cb96b74f47994aeb59088e4673f7"
        },
        "assets/ct-plane-check-BjBFpte7.js": {
            "bytes": 1286,
            "sha256": "b8b16eac01bf0ab0e80d3078e5a97f1aab06b323a8a17c8987977fe135b8c77d"
        },
        "assets/ct-ui-YuFuM6C_.js": {
            "bytes": 41691,
            "sha256": "e01afe4b07e0546f87fd3522b02b15b9bc7c5cbd708294e79bd32b3994ea1315"
        },
        "assets/ct-volume-check-CDtZ87Vt.js": {
            "bytes": 2690,
            "sha256": "4e1a96ef01231c77122cfb5326a644aa72bae1ee06cdd1314659905ed44990c0"
        },
        "assets/cube-root-BrgoQCGA.js": {
            "bytes": 346,
            "sha256": "58fc9ddae197e48e3b7f94b50e996f562fc1bd8d122495795f2ffe95d4d87e09"
        },
        "assets/data-switch-khAxwPqz.js": {
            "bytes": 525,
            "sha256": "19f591ac3452455b9f61d8f2b2f0d0c1d6611e50a10d31be937f3efc24e73006"
        },
        "assets/decompose-mat4-BfVyv977.js": {
            "bytes": 500,
            "sha256": "986c649ef18a36be4e20a2239697aaf5cf44cc1e6fa9bad16a88c7f71edea711"
        },
        "assets/deg-to-rad-CASLKcx8.js": {
            "bytes": 346,
            "sha256": "8b9b046606c08d7db55344c1b3eec1ee6c2d5c10e6651568f25e8acdb55127a6"
        },
        "assets/determinant-DZcTmvvG.js": {
            "bytes": 355,
            "sha256": "9c2f2628c8805baa0cda2f0f319428e318a3bb8189df3b22b3a1e00fa765f954"
        },
        "assets/divide-DLcTpdLN.js": {
            "bytes": 372,
            "sha256": "1ccca3d6c118a08f645630fe27118c03e94f423f170d7235b8be325eb2127fec"
        },
        "assets/do-n-B2x7tLK6.js": {
            "bytes": 717,
            "sha256": "c37fd1634184d3d25d21b4f18bb7fe166ffff157b6807b38df99e171e1d3d8ec"
        },
        "assets/dot-BYk4C_oE.js": {
            "bytes": 369,
            "sha256": "abbc9427611f4c591a229223b5335451dddb233f206938dde077565e925d2d86"
        },
        "assets/engine-BWFpvUuM.js": {
            "bytes": 6170,
            "sha256": "6087628e789a0cf1f878c4ce5a8780d93970dead65ecd0c16945ac8f9b5c5306"
        },
        "assets/equality-DEny5AF5.js": {
            "bytes": 380,
            "sha256": "f8d9d2af3896a9be0ad8734b0ffc82aabf61a4b1fe689e8cd33c881e6507be03"
        },
        "assets/exponential-Bc6G8vuj.js": {
            "bytes": 352,
            "sha256": "fe15ae3e3fb78da96085afd833e910e6122d152701e8308a04e572c89072a5cb"
        },
        "assets/extract-matrix-DuHOnVae.js": {
            "bytes": 435,
            "sha256": "fb40cb13afd5fdff1c472f7bfb5e55b03712818da1366a9e006bad999e054d75"
        },
        "assets/extract-matrix2d-CZuGTJXE.js": {
            "bytes": 439,
            "sha256": "4f2a2787e9c77b86d52539deb5997206a0e3d181e5068742f46030c0a99bd4e0"
        },
        "assets/extract-matrix3d-CGeYFKbF.js": {
            "bytes": 439,
            "sha256": "564df9574ac84cd0e2a7d7d3c50e8aefb233012a6cf70e4a03ba3036cfeacc5d"
        },
        "assets/extract2-CTsIA9g6.js": {
            "bytes": 383,
            "sha256": "6535aeae4f7257d95a24c69b32d7ea45b7041656c37b70845ced6c5efcdedfb8"
        },
        "assets/extract3-CfEvDOiq.js": {
            "bytes": 414,
            "sha256": "dabe4ade69e64ab1047ff803f9f30bcb5fdbca45980dd28364446d8588d6dd16"
        },
        "assets/extract4-E43C7hQB.js": {
            "bytes": 445,
            "sha256": "21726c0fa7ce95933d08b9cb881fdb04ab41a8bcfc89cf661baa57a031015952"
        },
        "assets/fg-math-D66aWcRG.js": {
            "bytes": 15772,
            "sha256": "b4462a75cfb68ddb646f2429ea10e36fd9dd6624cce568306309300ac970d103"
        },
        "assets/float-to-boolean-DA5S7sxp.js": {
            "bytes": 316,
            "sha256": "fe3dfdfb6abe86cffdf42d70ceb17692ca3fea600436fe8cb2f5f0897f020a94"
        },
        "assets/float-to-int-UoNjvIBS.js": {
            "bytes": 437,
            "sha256": "e054532054fbe9963898b03b1eaf020c78627d2a45661218c01e4d0990a9467a"
        },
        "assets/floor-D5AeLAFp.js": {
            "bytes": 332,
            "sha256": "f7442d7f29bd3b0e35c36c4e79299952bdfdd7934a5a3f7a5a61f0ed07066a8a"
        },
        "assets/for-loop-HTBGw4ru.js": {
            "bytes": 892,
            "sha256": "130785ff019c03fc6126124603dbfc3a73a1381d2032641b16530d54b1fd4e18"
        },
        "assets/fraction-DY38pZdj.js": {
            "bytes": 346,
            "sha256": "129daac379e9412efa0728ad748f093fc19ac5afce7e09c6b7cb732406a3a6ac"
        },
        "assets/gaussian-splatting-pipeline-sh-ph1_RGd6.js": {
            "bytes": 11536,
            "sha256": "9fe211d0d083089b8c1eb2bd73711ca9141079d9d2e29599b64501a6729628e1"
        },
        "assets/generate-mipmaps-BvJmJQOo.js": {
            "bytes": 1858,
            "sha256": "fd7ca2f248a5c49df2c36426a99a59dbc0269b5a9e2d32a9667b848681e4ff08"
        },
        "assets/get-property-CkpehsY6.js": {
            "bytes": 787,
            "sha256": "08c9fb292c76607100eeef286c56bd8f887442c217fead687441fdf2e3d14a52"
        },
        "assets/get-variable-Ag_ua31L.js": {
            "bytes": 292,
            "sha256": "7fffd04aff97dbe5c9615dea86732ea8f3ec401809ac73720d71369956451730"
        },
        "assets/gltf-animation-_iVKEzem.js": {
            "bytes": 3696,
            "sha256": "1a823f2495eea98bede0df5e42a52cccbdc3fdff36c6da28f253c7429741f13f"
        },
        "assets/gltf-ext-basisu-BX2SAJk7.js": {
            "bytes": 10734,
            "sha256": "03bf2bad59941ac2b211e35ac3985f32e573e64bd0254c021c32909621e65c53"
        },
        "assets/gltf-ext-dielectric-LEtNntMm.js": {
            "bytes": 4188,
            "sha256": "4c300b998ab291b1a84277484c3b46137d42d31d41ce8de4e2316fbf0b69a586"
        },
        "assets/gltf-ext-emissive-strength-DZGwlhcI.js": {
            "bytes": 306,
            "sha256": "c9faf665bfd6eab5634bf5a05aa3f07ea5fde3bdc352e0b4075f4f59f5202d0c"
        },
        "assets/gltf-ext-node-visibility-Dao0Bjye.js": {
            "bytes": 310,
            "sha256": "e06884f6b27841fb59c2d02552aa7299209461a7764539b5bd58df9cdfd4169c"
        },
        "assets/gltf-feature-animation-pointer-l-YQK2cG.js": {
            "bytes": 4110,
            "sha256": "dcbfc597d619f4e91a211a5553d3c85dddb3f75705cc00c0c706b9627e05dd70"
        },
        "assets/gltf-feature-animations-Bv9I8NMM.js": {
            "bytes": 1873,
            "sha256": "8c85046353869429366f8401d5074959abcb6a65476382e564e7d98adb9d1b31"
        },
        "assets/gltf-feature-gaussian-splatting-BBXlBIaa.js": {
            "bytes": 17897,
            "sha256": "4f66bb0c7bc1462af70c94f1b77feb5b8f50c4d6f812daa1e3e8edaa3dc93bac"
        },
        "assets/gltf-feature-gpu-instancing-Z1Hga0se.js": {
            "bytes": 1902,
            "sha256": "d7e312858124546de3ba3b91e9a73871500545a330fac1f75d850e0aba7a364f"
        },
        "assets/gltf-feature-interactivity-CA0zCwzq.js": {
            "bytes": 80169,
            "sha256": "79b1d498baca5f16d2537e27eaa51f0f46b7e2d2c0e97b533a715dd088e3ada3"
        },
        "assets/gltf-feature-lights-punctual-Dn4syc1Z.js": {
            "bytes": 3572,
            "sha256": "fd21045d975d2abb5779fa9719a4e7ba0c6c4c268f9b9beff3ce81281a37b17e"
        },
        "assets/gltf-feature-morph-CjC-j8Fe.js": {
            "bytes": 1033,
            "sha256": "a213bfb98e4591626fe6641af8d393fe6794e1abea17cbba4d93fc5041161aa6"
        },
        "assets/gltf-feature-primitive-CEXkuFwM.js": {
            "bytes": 575,
            "sha256": "c42f13382c71d57877528114d40d1949adae81129c28a4082c85603ea4dd68d2"
        },
        "assets/gltf-feature-registry-DhwZF-ue.js": {
            "bytes": 7973,
            "sha256": "555907f45a92900f28d3586b7fd94df7e960b49f1887d1d75f91d2654e9e1b8c"
        },
        "assets/gltf-feature-skeleton-DDV19od1.js": {
            "bytes": 3046,
            "sha256": "3a4d016981175f38244a0cf981eafb2313afa1211ce757847f04dc638c70b411"
        },
        "assets/gltf-feature-sparse-gm4qEOgu.js": {
            "bytes": 2077,
            "sha256": "572ec16fda974c335af88d4d549dede1644455089c7005e2ed4c457edb65e017"
        },
        "assets/gltf-feature-variants-eUJ7iIEk.js": {
            "bytes": 2195,
            "sha256": "29fa786aa098d5f8f91d301fea05625b8aad8efeae5a65625d9bf04dd31be4db"
        },
        "assets/gltf-interleave-BG61lVWd.js": {
            "bytes": 5502,
            "sha256": "ae3eb3b036f7bd180d81801168e98b8ee8376fca362bc4922e019f3ffa07ce55"
        },
        "assets/gltf-json-asset-DmEBXZhh.js": {
            "bytes": 829,
            "sha256": "a1943baf222f1af65b97d0dfa7a6559436369d3b0512c051fa0329d7172c3c3a"
        },
        "assets/gltf-multi-buffer-hsEY3P1b.js": {
            "bytes": 514,
            "sha256": "4f9370f9a8b5c03289792d8389ed3612318a80cab2ba779b65fc0ef254b4f06a"
        },
        "assets/gltf-normals-CW8aOx3G.js": {
            "bytes": 711,
            "sha256": "9bf7decb85c4eb21d5c4807c1da020e773f8f940d6505dfbb736de569bbdff73"
        },
        "assets/gltf-pbr-builder-ext-D8gzbgiu.js": {
            "bytes": 3707,
            "sha256": "2c5b53233aed04ea0675dfad3e6ca65d5b0a12a28b53981fe596950bab2876d4"
        },
        "assets/gltf-sampler-denorm-BA6qGiD4.js": {
            "bytes": 444,
            "sha256": "5a9a5d24b2fcc974f072b7ac049c5e55d0d912e16d2315647915ae5ab2734232"
        },
        "assets/gltf-sampler-desc-x4HKtvCs.js": {
            "bytes": 1728,
            "sha256": "f9369ee000c77cb612f4b182406e76cb6d4581a2f1157de0bde17b48109af858"
        },
        "assets/gltf-share-4vHBGv9C.js": {
            "bytes": 2601,
            "sha256": "9fd72ae3ce8490e6dd58dbe06869c161c384a9424bdf3a4b974e6c4612a93a1e"
        },
        "assets/gltf-variants-CLddWI9f.js": {
            "bytes": 2712,
            "sha256": "40d270fea496f687a46ee043b988745c1e48ea0bb821efb8cbe27a2fd14cbff4"
        },
        "assets/greater-than-hogdF-PV.js": {
            "bytes": 386,
            "sha256": "10e7093606a68a27605a7bddf972353bfb1e5fde180f057ff529a8c04233a3e2"
        },
        "assets/greater-than-or-equal-BiHNkGSw.js": {
            "bytes": 400,
            "sha256": "693bc5843571e055698c3989c873cf9273933c8c3c3ffa2d5ce8ea6d6f36e5c7"
        },
        "assets/gs-picking-pipeline-DivjUth8.js": {
            "bytes": 7990,
            "sha256": "73cf3dd28f4cbc7f12fe7f7c7bd15c5b3acacb99682b4d927bfcc62f9c2cbb21"
        },
        "assets/havok-thin-instances-C6V2uxre.js": {
            "bytes": 5756,
            "sha256": "933650caed81dba609ac1561d6da99678b3b093e58b2061096b62d6d1d262bd6"
        },
        "assets/int-to-boolean-x1jhS35P.js": {
            "bytes": 343,
            "sha256": "e0dcd6c226bd0bd718c33323619aa62309ab80cf60d70f682f63fb8ef06438e0"
        },
        "assets/int-to-float-DaNxEDGW.js": {
            "bytes": 332,
            "sha256": "8bb9b2a701ad3c95fb0525249e5fb0c78c9aefa034528b57d2819e3c6c4bd405"
        },
        "assets/invert-matrix-FAObWaxE.js": {
            "bytes": 354,
            "sha256": "4926628ff327363effba68a425c1813c1504224ada4125f2a502e35e0f15f503"
        },
        "assets/is-infinity-CF_VSh4O.js": {
            "bytes": 354,
            "sha256": "32f94adaed9d5ce41f858034e37b65c1ef508c3f675a4df1972a74ce5a66a49a"
        },
        "assets/is-nan-0LXhE9Pn.js": {
            "bytes": 344,
            "sha256": "d114eefb4de4bbbefa4ee8b04fe377b5c444131f0d61c6cb57a1089d239e8b08"
        },
        "assets/leading-zeros-fhlL-U6q.js": {
            "bytes": 354,
            "sha256": "94cb973d5fd0daf16668b2238acab85213a58d39b1b4d886d4931d01aecc8679"
        },
        "assets/length-BIuVktE4.js": {
            "bytes": 345,
            "sha256": "ad3f1e341706bd152276574ea546e57a6dd9d68f69936e860fae9adf28957a33"
        },
        "assets/less-than-YI9agrDL.js": {
            "bytes": 381,
            "sha256": "b053a81a27942e316ed34d07843217ed71cee5e62ccf2deacc288edc4bd16f5f"
        },
        "assets/less-than-or-equal-BSKwfzOy.js": {
            "bytes": 394,
            "sha256": "2653437e1d595823d92bad700807b04ccaf363634cd914a4bd90d503780e020c"
        },
        "assets/log-BL9l_EA4.js": {
            "bytes": 336,
            "sha256": "c86a02694f9ffd37bd3177cfab5227f0e3b69bc084a2e7246819b5c0f1fab85b"
        },
        "assets/log10-BuQhiBve.js": {
            "bytes": 340,
            "sha256": "461c9689a8917484732568f6a7e7bb05045e12296822c7ae6da2d51b22172f13"
        },
        "assets/log2-BANTymwq.js": {
            "bytes": 338,
            "sha256": "85a66c8bf17d1cf7f0bc1e37ef58d3296bd3776187c0e040a741e3d7462ca997"
        },
        "assets/matrix-compose-adjylhVU.js": {
            "bytes": 495,
            "sha256": "bfab72ca7bd92a0d86a9bac300ca8ec77ba461b23124ee3e194643c391072f6a"
        },
        "assets/matrix-decompose-BqOT-A6J.js": {
            "bytes": 584,
            "sha256": "2794050645b16d700bb455270848dfc06dfcad681c79c474bde9cb0d16c6c7c9"
        },
        "assets/matrix-multiplication-BNF89xYd.js": {
            "bytes": 401,
            "sha256": "771deebb7bd0b834e4d3a1ef8555a01d28cf0d589b4d780a3d627b5e483f5a91"
        },
        "assets/max-C1lcIXyh.js": {
            "bytes": 367,
            "sha256": "1a3ff900ddf0b798414c6234ce70b76aa1235fd53d81c0f8bf7bcbf1acea53aa"
        },
        "assets/mesh-light-layout-LJRbgbXg.js": {
            "bytes": 5980,
            "sha256": "00a38ff31da29eef7d1a25dc400287a5a6169059da2869e554bf376c8b00fd81"
        },
        "assets/min-BfzSeUng.js": {
            "bytes": 367,
            "sha256": "187d8c3ec1bae1b6478d429b4632a244e46ff48171da8f8a7972b0f2394c1a15"
        },
        "assets/mix-a7gGdgiG.js": {
            "bytes": 425,
            "sha256": "2df59816a03ecd4a57d89f672180df18893a5458e778a879ed7f66843bcb7656"
        },
        "assets/modulo-DCa0OO-Q.js": {
            "bytes": 373,
            "sha256": "d5e59398a1cb84e679044fd75ecf9c2d7c34be7dd26167969f1013b1e093b7ec"
        },
        "assets/morph-fragment-DCaYCyDu.js": {
            "bytes": 439,
            "sha256": "6aadad6694f058c0af977271066c1e8b39873b0ae690508c9583f117b8b9b6eb"
        },
        "assets/morph-fragment-core-eOl-L12-.js": {
            "bytes": 1277,
            "sha256": "59d5f1cf4e44d44130bbd7f2adb7776b5ef4cafd02597f1fe0467fbac4ea75fd"
        },
        "assets/multi-gate-BVicmbrL.js": {
            "bytes": 1000,
            "sha256": "571e3b818bb479d4ed43c6f16b41ed6d869de9ff1019c27906b02900e6f90404"
        },
        "assets/multiply-DhVwsmfX.js": {
            "bytes": 377,
            "sha256": "4f7bfee1fadcf459cabe1a1ad33a357876cf66a008333a49a6cb1f0c147e2790"
        },
        "assets/negation-B6HKySvL.js": {
            "bytes": 347,
            "sha256": "4bebd08aef707c287787f2666f59c134ef22f07fa042403efc24ae2877f97c98"
        },
        "assets/no-op-DlmxSW4o.js": {
            "bytes": 490,
            "sha256": "d2a9f9d425375d771b8838b57d7343a7c0887e3066c06a8dbd3d49d4e57250d9"
        },
        "assets/normalize-CxK2eHgI.js": {
            "bytes": 349,
            "sha256": "f72b61244a79abe406397ffe07d70f2131668b3b97f76d73ec48c5011486b662"
        },
        "assets/on-select-Bap51OnK.js": {
            "bytes": 648,
            "sha256": "38bda60de7d1214e393162971c4dc41064dd8b8dcc696a232641147bfcb79c74"
        },
        "assets/one-bits-counter-Djuwz8YR.js": {
            "bytes": 359,
            "sha256": "cb70d0666a73a1f61153a1dfe5b8889790b89ce74212981733cce60cc0f18791"
        },
        "assets/pbr-renderable-CCLuFE9n.js": {
            "bytes": 19838,
            "sha256": "774b8d84d620f942ffb495366ab69cc1268cd1506126e13878856114e1067a90"
        },
        "assets/pbr-transmission-ext-DU5peuA3.js": {
            "bytes": 16909,
            "sha256": "e733165e83faca5d3d8c0b9add9cc27e5bbc527f5b1109451fa456b277429e9b"
        },
        "assets/picking-advanced-draw-GC_IxFJf.js": {
            "bytes": 12773,
            "sha256": "31dc7fff35a85226ca298ed1a13ff0681a2322e248a3fa80c5ab350b1142fdf2"
        },
        "assets/picking-detailed-pipeline-D4Vtm2jf.js": {
            "bytes": 3056,
            "sha256": "9fff01da653c0142c15823c6388252240c531b3beb7348e2902dba56a126abc8"
        },
        "assets/picking-pipeline-DUr1Nvw_.js": {
            "bytes": 3270,
            "sha256": "7a25085997ebbd9a04ddbb7d179660cc18d3ee41db8f6cdf4b900c7e9c4e7b51"
        },
        "assets/play-animation-DSL6RsAy.js": {
            "bytes": 1122,
            "sha256": "4cf9948ba4e5323da8d91daf69fd88b2093adafe7692d930327bf25c652cd546"
        },
        "assets/point-light-BUKMYxo4.js": {
            "bytes": 703,
            "sha256": "e3b60f3b0df1dfc3f669d1002b3ff46fe0e082253325830ddd2903ddffb7814b"
        },
        "assets/pointer-template-BtBQBrfJ.js": {
            "bytes": 963,
            "sha256": "a7a82d650bbc75b9f4ab860b097b8c2c95e6ec7c88dfb5707db98a7b09287003"
        },
        "assets/power-MPWi_OpH.js": {
            "bytes": 371,
            "sha256": "f256278568884a14763dd8ff7455d1f349f067f48f984157e979bffd854ae8e6"
        },
        "assets/quat-conjugate-UT_P6HPM.js": {
            "bytes": 366,
            "sha256": "27d6c2adc21c67650e9bc04343fcfdc44d8d6ff01b21a9f161e4c69de577111b"
        },
        "assets/quaternion-from-angles-JcgTQdTh.js": {
            "bytes": 447,
            "sha256": "854cc93ed1939be9c3e718077caec56e14bb9795bc74bf2c076dd48d5f03f07b"
        },
        "assets/quaternion-from-axis-angle-D8yGoLLs.js": {
            "bytes": 421,
            "sha256": "ae692f862f385ad1410f79f72acb4d957f32be30a10436394e036902bd785513"
        },
        "assets/quaternion-from-directions-BbfdlIQw.js": {
            "bytes": 424,
            "sha256": "263ce7218cd4dc41a6c72d60c380f665fa87b4e3a6f3cf010037dc4b38dc0db5"
        },
        "assets/quaternion-from-up-forward-EGRMbKOK.js": {
            "bytes": 410,
            "sha256": "e4ecac0a5882158ddf5ae153ea98f28b567a4d611afe3cb2f779a6a839bac138"
        },
        "assets/quaternion-multiplication-DwZ_BMN0.js": {
            "bytes": 416,
            "sha256": "be835fdb5602bc7ae9609ecfce6ac41c0761ae38d0d8964add6e0a2a6d75b347"
        },
        "assets/quaternion-slerp-D6lgP4WN.js": {
            "bytes": 417,
            "sha256": "429fb5bd65fc3c9a41b9edaa95b00c825fadad729b77eadb22197c152f7e384c"
        },
        "assets/rad-to-deg-Vu9T4qgo.js": {
            "bytes": 347,
            "sha256": "bb9fa2797ee984c27336b69e2cd9231e6e20b8a7d209be6cbcb967dda0f1f9d3"
        },
        "assets/random-BB53MorW.js": {
            "bytes": 394,
            "sha256": "52ee0302d161b5db2ce2fb569af147ae90da81c3685ab404bd1127b7d1d08918"
        },
        "assets/receive-custom-event-BiHRobdW.js": {
            "bytes": 634,
            "sha256": "566ce85e847a653e5d20006fe05e2dfd0ce50b33de63833d6d01b4761f065dcc"
        },
        "assets/reference-CwpuuO1N.js": {
            "bytes": 120664,
            "sha256": "44fcdedc37ee71fdefc1cf21e783bfa53c42de53c89d0244e9743e3926a44d8b"
        },
        "assets/reference-ui-CIs1T_6-.js": {
            "bytes": 27050,
            "sha256": "1cd98acc792da892c1a825660ed7d454614a8b3f0d3180fbba5ac253938e90f9"
        },
        "assets/rgb-from-oklch-DsC2yK89.js": {
            "bytes": 475,
            "sha256": "f32c596b550e3b0afac0f626e836882c7dd9bb6cf4e5e8c4ec70efb0f23c4fe7"
        },
        "assets/rgb-to-oklch-BRXixhcp.js": {
            "bytes": 471,
            "sha256": "b98af745815c58d3d8331c4acf4f2c0b60bb09b5ec2f47b9acda371bc4ba9a31"
        },
        "assets/rolldown-runtime-DK3Fl9T5.js": {
            "bytes": 158,
            "sha256": "a526d1bb3288ef04d001028843220a24b0867a4edf8c685b69506d6525af36ff"
        },
        "assets/rotate2d-CIpEO9my.js": {
            "bytes": 388,
            "sha256": "b0dd5f046a57268691ff4042bde2154a7b1270b3bd4c969507fabeaec7a3b316"
        },
        "assets/rotate3d-TmfVbBou.js": {
            "bytes": 392,
            "sha256": "c2360be9d3f2561c09f23f72e8d6f0126984c96f3689b4083367932672286807"
        },
        "assets/round-ZvCILAP0.js": {
            "bytes": 341,
            "sha256": "9955a853b5fae377b31998c76670fda2aa21e0682696cac8d9017b63a506e20b"
        },
        "assets/saturate-BtA3xF6v.js": {
            "bytes": 347,
            "sha256": "1069665cf3f518a74f1efbead2693c24da83565e8b20623d16c318a1bfa8a19d"
        },
        "assets/scene-start-CwO_hiLN.js": {
            "bytes": 436,
            "sha256": "d13d4a8829cf769cf4b1b0c15c9e923eec599902a198cdcb8da3ff64750a2306"
        },
        "assets/scene-tick-BL6kEyMg.js": {
            "bytes": 763,
            "sha256": "671a3d4b5528d8c558db5cd61f2f8ce2a33c23b49b68300d740c841fe6434320"
        },
        "assets/send-custom-event-u16B_O9I.js": {
            "bytes": 603,
            "sha256": "fc3f8d9f5c5ef04cf61ef2899030e6ea8d2e5cee3c1225217aacc88e694c2bdb"
        },
        "assets/sequence-BQMdz2Tg.js": {
            "bytes": 357,
            "sha256": "726e94b6f19e5f20e5b9f53807cd63908fb71cfca7d7981c1fc2c88247892ea8"
        },
        "assets/set-delay-DlG6IBXh.js": {
            "bytes": 1293,
            "sha256": "6f00cd8cb8472e84b19e4c55b83e1f181d3f7d74773db8e31c264bcbba475d22"
        },
        "assets/set-dispersion-HqHvaHWi.js": {
            "bytes": 1062,
            "sha256": "dd227e6ad760986d601d639ae2d701e28a31720d355bd6e659410bbe8fe4a641"
        },
        "assets/set-property-PEd5Qm4g.js": {
            "bytes": 897,
            "sha256": "e0263809885ff140e704d92ccdb41fd0d187132dcc54904d55f5b74da8e30167"
        },
        "assets/set-transmission-Dqb7MpJj.js": {
            "bytes": 205,
            "sha256": "720adaeaec9813f31cdd074461ddb5df3b8bdaeea7d99cb786b8a48b0ebed8da"
        },
        "assets/set-variable-QwwB9TL2.js": {
            "bytes": 680,
            "sha256": "ade461cf192751f7da03dec10900bcbfcf119171d5f7c72dfa6a01ac03c702d2"
        },
        "assets/sign-BuqdyGss.js": {
            "bytes": 339,
            "sha256": "c310e7da8dc530ade81324271d0dc769a2a567f7021783f48f89239ddca5e576"
        },
        "assets/sin-DazO6jQt.js": {
            "bytes": 337,
            "sha256": "fa376c28d13a88cb18ce9715cb23f4d5dbc28788ea30b0e994a75539d2419202"
        },
        "assets/sinh-5fg-dz4d.js": {
            "bytes": 339,
            "sha256": "d3a9caa6446ca0d1d069aa36406cb2c46e79de287c60d2080a15defa3384523b"
        },
        "assets/slice-ui-DnJLFNhm.js": {
            "bytes": 7301,
            "sha256": "adeb67328411602d3027b35c759374851aee0ee3d0535b2beeb8e2a59f93149a"
        },
        "assets/smooth-step-B2XLtysf.js": {
            "bytes": 395,
            "sha256": "6fbaa5d9d94bf2d6705e2a7ee76c6932f602e1954355dd7391645568257d5255"
        },
        "assets/spot-light-HQgtYqL_.js": {
            "bytes": 1076,
            "sha256": "6edce0187c30576875f5718e1aaa2a79a5c8b78f40014d4dbd8d97c8ce8366bc"
        },
        "assets/square-root-CrFKvxIQ.js": {
            "bytes": 351,
            "sha256": "5c3555e9fff36b94b4e075430f99d3ee4449e98928a636dc4c852ea7c6339234"
        },
        "assets/standard-renderable-teMolvQk.js": {
            "bytes": 12512,
            "sha256": "4ea28a65ae6097c5c720968ddfa7f627b4a873888e39c2fcb9cda66e41f1f11b"
        },
        "assets/stop-animation-Ddj8Elbh.js": {
            "bytes": 1085,
            "sha256": "42dd729099e57faeae3a75ebaa6b43d0684de64afaf4193a7437287d387833c2"
        },
        "assets/stop-event-propagation-C_QCG6vy.js": {
            "bytes": 477,
            "sha256": "229d9c1427914fb7b7082bd4296ac654e6465f63ca0430233f5ec6030a9c1313"
        },
        "assets/storage-buffer-DlPxBRdR.js": {
            "bytes": 3632,
            "sha256": "48cff3b066a283f4a8bc9c8743a840d2c929cc498365ee6c67405f8953017fef"
        },
        "assets/subtract-DByDZWCd.js": {
            "bytes": 377,
            "sha256": "eee31ffae61c089569990de0e04c0e70582f7b84d9f70240c7379d5398bff3a0"
        },
        "assets/switch-CWMR7ipO.js": {
            "bytes": 531,
            "sha256": "3eaa925b43506add9a3e2f41ea4967ac34337bf954d8880d3dfb8583a635575b"
        },
        "assets/tan-CbdCih_C.js": {
            "bytes": 337,
            "sha256": "018a18f40db3399e116999a4818fa2ade362095364bf2f4028a45cbe46625f56"
        },
        "assets/tanh-miaPeA2x.js": {
            "bytes": 339,
            "sha256": "517f5e8a38bb3193bc685c6d1dc32051478ed82396fb1850e8f294a151143716"
        },
        "assets/texture-release-DilYBmj3.js": {
            "bytes": 232,
            "sha256": "212f88eef4dd4ed3a31710acda9d955f67feaa69b7a299edbd46df63c049023b"
        },
        "assets/thin-instance-cull-binding-BBkn6_O-.js": {
            "bytes": 14523,
            "sha256": "6a1339d1633a0afb26c24241b1ee2f11ebf97f4f89ac9386acecf0fe88b170f0"
        },
        "assets/thin-instance-gpu-hVo1QVnr.js": {
            "bytes": 2844,
            "sha256": "21e93a700139ec4c3359426d5e6a814d7d8a1fdc606c8dfb8593874079864a56"
        },
        "assets/throttle-DP9G_3Zl.js": {
            "bytes": 1030,
            "sha256": "8af083344e161f4c339bc80c011fad8e61fe37c3f56f7da27728d756971141e5"
        },
        "assets/trailing-zeros-BC_LQWtt.js": {
            "bytes": 356,
            "sha256": "1d51dc08499e78bda296165f668d613abc43a8ce442133ade9efb50a2340585c"
        },
        "assets/transform-vector-B_REEfLn.js": {
            "bytes": 391,
            "sha256": "ee658084cb648a14f3d62c6f6820bf2127219c5c4559cf7d5126a772013d6668"
        },
        "assets/transpose-usRStPwO.js": {
            "bytes": 349,
            "sha256": "ec7f50ac4c103c454a8fe35db04add6d54c3903408d904cef6c4ab9af65037e2"
        },
        "assets/trunc-WhrSCgqQ.js": {
            "bytes": 341,
            "sha256": "2040963d08aa7800f8d26b3fea3a3daa087520f551393ebe9b54acd302de8e49"
        },
        "assets/value-interpolation-DfARvUAm.js": {
            "bytes": 3907,
            "sha256": "87b3641412ae76d72102cc9c5b2de120e3630f69b1bbe1dbd0b780ed881471f2"
        },
        "assets/vat-picking-pipeline-DGlPjy-w.js": {
            "bytes": 4823,
            "sha256": "559fb17f82c64e2df34d22dfa3d902511368b0317619d080b3d4c01f79a5cec5"
        },
        "assets/vector-slerp-By0Nyj6e.js": {
            "bytes": 400,
            "sha256": "f688334334d10a7182acee317bd3aec1622074ed9260401088df372bbea96334"
        },
        "assets/wait-all-DJanHXGh.js": {
            "bytes": 1085,
            "sha256": "1f5ee8469e2f6e8c788dbc7fd7eb02041854b5839724e74e064275465d12637d"
        },
        "assets/while-loop-BaPFWaNQ.js": {
            "bytes": 473,
            "sha256": "08f616f3fa2fd65c638878cadea5248d274eeaf0e25b3291d1d650f0654dbde0"
        },
        "reference/female.glb": {
            "bytes": 300172,
            "sha256": "d1c1757c219041d9e2c9c7edf6521dd7c8a4e8a3776ed2556fa7f951f6c85a9a"
        },
        "reference/female.manifest.json": {
            "bytes": 4697,
            "sha256": "ce33e65abbdca8d45aeae82d472967d360860f4fd30f147bc8554f92ea21e831"
        },
        "reference/male.glb": {
            "bytes": 300088,
            "sha256": "8c712fbc8cc7bfed56dd16606b2612679e98ca1816720ad1c2813afd23d6ccab"
        },
        "reference/male.manifest.json": {
            "bytes": 4691,
            "sha256": "90398795f2615597aa336a7f8536b3ac641a54b5269e7e835d37849cea2d7bb5"
        }
    }
    policy_sha = "282c8029a22bcc6ab808489fd329ba6e37b66018768e2908c66e8cc1dc3cfb43"
    viewer_sha = "708bf20f3d8f36ab8178bced27d8b7d792b2f9998503368372dc34b47a111688"
    descriptors = []
    retired = []
    missing = 0
    phase = "preflight"
    try:
        def require(condition, message):
            if not condition:
                raise ValueError(message)

        require(hasattr(os, "O_NOFOLLOW") and hasattr(os, "O_DIRECTORY") and hasattr(os, "O_NONBLOCK"), "host lacks no-follow file operations")
        require(all(fn in os.supports_dir_fd for fn in (os.open, os.stat, os.unlink)), "host lacks directory-relative file operations")
        require(os.stat in os.supports_follow_symlinks, "host lacks no-follow metadata")
        require(hashlib.sha256(json.dumps(targets, sort_keys=True, separators=(",", ":")).encode()).hexdigest() == policy_sha, "retirement policy identity differs")
        logical = os.path.abspath(os.fspath(root))
        expected = os.path.abspath(os.path.join(str(iris.cls("%SYSTEM.Util").InstallDirectory()), "csp", "dicom3d"))
        require(logical == expected, "root differs from IPM CSP ownership")
        # The approved host deliberately aliases this root into its durable volume.
        # Only that root mapping is resolved; child directories/leaves never follow links.
        anchor = os.path.realpath(logical, strict=True)
        require(anchor in (expected, "/durable/dicom3d/csp"), "CSP root alias is not an admitted host mapping")
        root_fd = os.open(anchor, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        descriptors.append(root_fd)
        def identity(s):
            return (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns, s.st_uid, s.st_gid)
        root_identity = identity(os.fstat(root_fd))
        require(stat.S_ISDIR(root_identity[2]), "CSP anchor is not a directory")
        require(os.fstat(root_fd).st_uid == os.geteuid(), "CSP anchor is not owned by the installing IRIS account")
        def root_unchanged():
            # Directory timestamps change as files are removed; anchor identity is dev/ino.
            require(os.path.realpath(logical, strict=True) == anchor, "CSP root mapping changed")
            require(identity(os.stat(logical))[:2] == root_identity[:2], "CSP anchor changed")
        def file_hash(fd):
            os.lseek(fd, 0, os.SEEK_SET)
            h = hashlib.sha256()
            total = 0
            while True:
                block = os.read(fd, 65536)
                if not block:
                    return h.hexdigest()
                total += len(block)
                require(total <= 1048576, "retirement hash read exceeds1MiB bound")
                h.update(block)
        # Bind retirement to the actual accepted060 frontend entry, not version text.
        entry_fd = os.open("reference.html", os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=root_fd)
        descriptors.append(entry_fd)
        require(stat.S_ISREG(os.fstat(entry_fd).st_mode) and file_hash(entry_fd) == viewer_sha, "current060 frontend identity differs")
        parents = {}
        records = []
        for relative, wanted in sorted(targets.items()):
            directory, name = relative.split("/")
            require(directory in ("assets", "reference") and name not in ("", ".", "..") and "/" not in name and "\\" not in name, "unsafe retired relative path")
            if directory not in parents:
                parent_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=root_fd)
                descriptors.append(parent_fd)
                parents[directory] = (parent_fd, identity(os.fstat(parent_fd))[:2])
            parent_fd, parent_identity = parents[directory]
            try:
                before = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
            except FileNotFoundError:
                missing += 1
                continue
            require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_uid == os.geteuid(), "retired entry is not an installer-owned single-link regular file: " + relative)
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent_fd)
            descriptors.append(fd)
            opened = os.fstat(fd)
            require(identity(before) == identity(opened) and opened.st_size == wanted["bytes"], "retired identity/size differs: " + relative)
            require(file_hash(fd) == wanted["sha256"] and identity(os.fstat(fd)) == identity(opened), "retired old hash differs: " + relative)
            records.append((relative, directory, name, fd, identity(opened), wanted))
        def recheck(record):
            relative, directory, name, fd, expected_identity, wanted = record
            root_unchanged()
            parent_fd, parent_identity = parents[directory]
            parent_now = os.stat(directory, dir_fd=root_fd, follow_symlinks=False)
            require(stat.S_ISDIR(parent_now.st_mode) and identity(parent_now)[:2] == parent_identity, "retired parent changed: " + directory)
            require(identity(os.stat(name, dir_fd=parent_fd, follow_symlinks=False)) == expected_identity and identity(os.fstat(fd)) == expected_identity, "retired path identity changed: " + relative)
            require(file_hash(fd) == wanted["sha256"] and identity(os.fstat(fd)) == expected_identity, "retired file changed: " + relative)
        # Complete every validation before the first unlink. A failed preflight removes0.
        for record in records:
            recheck(record)
        phase = "retirement"
        for record in records:
            recheck(record)
            relative, directory, name, fd, expected_identity, wanted = record
            os.unlink(name, dir_fd=parents[directory][0])
            retired.append(relative)
        print("DICOM3D051_RETIREMENT " + json.dumps({"status":"PASS", "policySha256":policy_sha, "retired":retired, "alreadyAbsent":missing}, sort_keys=True))
        return 1
    except Exception as error:
        print("DICOM3D051_RETIREMENT " + json.dumps({"status":"REFUSED", "phase":phase, "policySha256":policy_sha, "retired":retired, "alreadyAbsent":missing, "reason":str(error)}, sort_keys=True))
        return iris.cls("%SYSTEM.Status").Error(5001, "DICOM3D051 retirement refused: " + str(error))
    finally:
        for fd in reversed(descriptors):
            os.close(fd)
}

}
