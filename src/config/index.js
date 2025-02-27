require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/xpediapart',
    options: {
      // MongoDB driver 4.0+ no longer needs these options
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  scrapers: {
    timeout: parseInt(process.env.SCRAPER_TIMEOUT || '30000', 10),
    retryAttempts: parseInt(process.env.SCRAPER_RETRY_ATTEMPTS || '3', 10),
    lkq: {
      baseUrl: process.env.LKQ_BASE_URL || 'https://www.lkqonline.com',
      apiUrl: process.env.LKQ_API_URL || 'https://www.lkqonline.com/api/catalog/0/product',
      parallelRequests: parseInt(process.env.LKQ_PARALLEL_REQUESTS || '1', 10),
      requestDelay: parseInt(process.env.LKQ_REQUEST_DELAY || '1000', 10), // milliseconds between requests
      batchSize: parseInt(process.env.LKQ_BATCH_SIZE || '500', 10),
      useCookies: process.env.LKQ_USE_COOKIES === 'true',
      cookies: process.env.LKQ_COOKIES || 'userId=299078579207720039; _gcl_au=1.1.2256666.1740073657; OptanonAlertBoxClosed=2025-02-20T17:48:59.361Z; _gid=GA1.2.248167551.1740598796; BE_CLA3=p_id%3DL2R44J2JNA6LRR8LNP68JPRJRAAAAAAAAH%26bf%3Dundefined%26bn%3D4%26bv%3D3.47%26s_expire%3D1740731677948%26s_id%3D22R44J2JNA6LR6RLN628JPRJRAAAAAAAAH; OptanonConsent=isGpcEnabled=0&datestamp=Thu+Feb+27+2025+13%3A34%3A38+GMT%2B0500+(Pakistan+Standard+Time)&version=202308.2.0&browserGpcFlag=0&isIABGlobal=false&hosts=&genVendors=&consentId=c543c4e8-c332-4240-b958-5d81ffa9eec5&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0004%3A1&geolocation=US%3BIL&AwaitingReconsent=false; _ga=GA1.2.813824047.1740073658; _clck=1ev9zw2%7C2%7Cfts%7C0%7C1877; _clsk=pspem7%7C1740645995425%7C6%7C1%7Cp.clarity.ms%2Fcollect; CCbdcy63=A2CWeCSVAQAAWVKiCmu0QCpQ2v8Ij86QVmtx5p8U5mmF5g6OR9Y4RgEY-c35AdiDTKmucpbCwH8AADQwAAAAAA|1|1|22781685124e5423d31feca55461d255ce92a289; _ga_LHK15G9CXP=GS1.1.1740645278.3.1.1740646041.6.0.0; _uetsid=7540a670f47911efa40f079d80516968; _uetvid=c7137e60efb211efa200c53b7475bae2',
      categories: [
        // Initial category to fetch
        {
          name: 'Alternator',
          path: 'Engine Compartment|Alternator',
          estimated: 30000, // Estimated product count for planning
        },
        // Additional category
        {
          name: 'Battery',
          path: 'Engine Compartment|Battery',
          estimated: 1700, // Estimated from API response
        },
        // Add more categories here as needed
      ],
      // Array of category URLs to scrape
      categoryUrls: [
        'https://www.lkqonline.com/api/catalog/0/product?catalogId=0&category=Engine%20Compartment%7CAlternator&sort=closestFirst&skip=0&take=50',
        'https://www.lkqonline.com/api/catalog/0/product?catalogId=0&category=Engine%20Compartment%7CBattery&sort=closestFirst&skip=0&take=50',
        // Add more category URLs as needed
      ],
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Host': 'www.lkqonline.com',
        'If-Modified-Since': '0',
        'Pragma': 'no-cache',
        'Referer': 'https://www.lkqonline.com/alternator',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        // Adding security headers that appear necessary for LKQ API
        'Expires': 'Sat, 01 Jan 2000 00:00:00 GMT',
        // The following security tokens are updated from the working example
        'XvPW5hYbpt-a': process.env.LKQ_SECURITY_TOKEN_A || 'Qy=Pj6kYHOZ6DKzZwWMQhe8kT222t2BDvb=DSI9N9OaJIvCLU7-TXP0-Mo8wjme2pT417tqk6xS7EJWJoIsphvrnsuEUE=YEpeR_wZSfwhimymDDFEp_Magh=Cjowq-=KTE6WAXZkuPbEsK=JFXz1V3=wywznj5S0euauETcJ7ez9zHCWf7EzcwgNvmq0bDR4AHKdo=M3p4h4Ky1kWJYRroSgcBtpChxBkT6P2kYnfXsqUFTbFcA735HA=0U4yRbBO0s9KJtSMuep1nr8r0NQscVd5Ya-_93yc7axfuBteS81Y1B0gK9PLAvk6FGO=CJK1O_biOddRzp6avUswKJ7i9pLAar9ZRg=dvwoei4vIeAotckp06eW7BOghJchjt=O7YJtFVnAnRE6xCN3cDNaGQ82R4_i-vO1ZHu-Hs9GqqUsvTFdNBNO3HPxe9PprXqTXI7IBgpIUacv2cnzmKVMkotMeIeAvVnwdfkL9u3USVcTaOnnX7A9mGed7dwr2a6c6=0Y=q5pw6hJW2NMMpSGGYtSNEOC-Ox2ASUjxutJmjKNogWYruDAeUPtGts7DX8AKNzw2baGo9wD8cbKkP-YXeSZmoKuQJtSuz=qUUA4ei34MGkpeUDotAgEaUTo-B1CAiP63V7UJq4o2SIfz76qnFHmTY7bMd4O=Joxq=NdTSSCd9fW6gC_1bdjtRPyYYkPkk=VHG-=b0w6C9L2ezAS6Rz0GgfnF78YCDxKd1BqS1QTAGiAVZPvVPI0jHKMsFoYH8sktLsec5yrpLSuXyh3pzImgNgSYLRap_hUkSLzkr5__SVNQ1rjWcKXRA3h2BIr-7ELgnVv6BZe2vnuhR9F3wy=Bj_eAXxZU9a4tTZbF_vUP_iamObBHMqmiENvuS_UstiBUWbLqx-KBmJN2KbjMC3nNRZDatz3oRy66iK-VU0xThq=hORyYO82fq_Q_burgf7-8fAyrsr4gQG1nIoR7OYd7EU=bQyIjAmuhdvQ=eDjG2SXhWw=s8gjgHNyj_8HVLmSrw8MAUdCFpQ59BiLkHkOSO9IjQrnvkOzAWXX7H5DuCY1UmnS_X3anpExdQp_uZ1OSUwH4vv7L4KLyY17QBHG19A2=1H-mvgWZ8NAjUSnuVvxSwyJ43noMO6-Pu_MTjoYCLbBdaWjRHz-FAcNB0t1bntwhbIz=Jby3ceYsmqItJQETrCPKYbqoNmomV_eOXIgp2VPs6=41Oa_CUER9aMzguB9YrEVAoNGSwWxG5YjAjDxD=JxfqZEFLuA9XuW7uCyurg7u6EEMWnUtgExdO1kvNR9qOjrGv1H5tFDcgMnt9DfrdQb4VROerjCo0O7-WMxOHz3_7bQ9Fs0xWv8y1ATb-QEO7Z_ukMmDRdgBYr4jHS-vwA1nYmOoQ91ugNpZ0WphNXR0OPTY=M2dSd=y5r2dmE1QAx7fuReBGI9So3c69MAmKEKCunkav7BmZ2qpdgg9=Nkt_I6337v4V7a3zOnEBebBnTucgpcHGhiEQFguhFgM6VrNQdzGqaX4484gLtnsXd6MCAvXz0MPcjCA6emsM8Ka=fcxbODTmxGG=tpDKr7aetT9dqp9J_ekDzSsXtJRmJEKXzYrhGdCBpu4JCfvfQbXxYXvMMYSch7gWnRdtYkX_qreHJOoCG7JMqHpqgFOYNajZdPkEeH0qsnePrENmBtvTpwxRz6y1_KtOjLsP-_G7a31eA8=sxtEh63OLtDjrX7BF_0S5QBy7vnPNhFqL9pfX1NV4QLZfFoCxWG7XuiL6t=f-0GwSHX3w8a42evuVQJ=P4EjWkTwmvzwkJ_3DEAKkCPzsB488y=SixjXcw0NSG1xIGdtU04CIDr-EKH3P=kS3Fdgod2IAAiwUHCuhwfXb2Nbb9QbyJTMQZ-WGiHvt5YBKfp7mtpiiszRW3VWyEiLYIumZfAmiCE5YbFFu8Me4ILhLOig3a7GtjDWA7FPfoaPRs9VaqGP27dtI=_j5LJ0rFjH1NDp1W7DubUK7LOM9Kkeku7jt-wXq7fP9WM0yXEF8fp_3-Os6OUJ=3vgcmLzskutNfavsRcYJbxy4aE5bI8dSdS1yBV_Nnz8Pz-PWei6zAKWgrGmwb853x6W-pkJq=Tg5vWR6EOQfx4d4CG4_9wFVh3Eto5KFO_KfPdtbRa_xPQnJFN=eSxY6skVKMtUNS1416bXF8jYimNgc6GjZbIU1jAz_biy=8vVeE67MpmK2WtR-kF4u2MCfTiowQRoFYKGoJtbb4gLP57n2z-TpDY0F8ZnJ3Wz2T-cV018g9BV9_ih_W2XkERzq=JhVupXRJFeOe=uJxtAvt0ZIhmrP1yzdaCWsWs7A18HKBe4UK6h4H=g-7a=0vRYsu1ePjDdtSZvk6OKE23guCrLBIzUkUnoTxFKoLOJsM8jiya9xODULrxjiG2BT78f7NP726WhP5wfDqfk1PX1h_faB0WK2SFbqzpZ3dcrRfVB1UYUyV0hQtr=io_Spc_AkCXSyK8XU4uPIs_5MdxCxfhQBoYoZ2ALfeIbNpNNfXN=Yv1Cc3_7mhqw_YkQIA4ZhJIHUImr212f-jh0HQBnyMJcDvQIRdP0zaSAaunS7PLAkjfQ3FKw1OMUMjrU-kyeh_rbDNemNm7Mxjqdp1rP8wN0_Zzq1O-DLLoqReX0i7cNhH0IecJhRW0aXfwyFaxkbg7XH7sGRwmN1J6_RmBsvbbvP9Ve=yKXm3PKe-zoGjEw7wtEs0aVV7IWO8ZKygVJ=aCIu_XjUkhj8fMSaW7cDPk5zFupTH0HaMwaMDJ5yza3JHnHcCqi2BDsmSTduLPOZoYwz9eSZ9sLfPytpXrHbzCw-PuFX1Xz0_xvwKI0W5uneOv1MU68OIZnd0Fx7DjH2oBs08OW9XZ2NquFX1d1g1dKrGyOOzkB7X6-J=JTp=QGC0RUIuOAMZdwTPiDTX72dzd17ppzQpr3M_Pr43moP8gvH2QmCx0dEwpJjLfuK-vsamIMjpyKjRuP7eePqYJMB_4KrNiitShamHvLPohgc6shAf1VZLhdF9dHHAt91u4=ABecwbMVTPTEvwYUWzh3zzQ3sM31hFzTejMq3G5foZnBzdqxOh1R1UVjiCYmcd8wYbco3Du2oXwWAykKfCxmEie_dAPsOZcFC_y05MRwGnzIo0hKxCaMXn-aQ-50LAV483VIj6EEx9_2mD=2Tpogmvsh6vfD0=iy2xyAGMMVHVFA3UUv8SfgbG-8kQh60_TQwN8WSm2_nxkZFe=RPPd2-4EbmArKWDoBQWW-mng4frkDfA7f-ooSwL22PcJbmM8rgtAvxWEQ6covuQpEqI26xS7FUs2tZ0=C7-QOCCk7VCAGbjYBZyEWcm5audyLOnwiJKy5nM9S2UgZCsUf439BBEtzNXSrOZcQGj11sdWBm5uhnLXKI1KTYqMeb0Pu7KHpsune5wk4htYZ9OPEOfF6OfhB-9Xq9U6pLS1Ogks3yCdOZ2MrBJv3oEqFhNwyhFsoQSFznOKgQThQSrfYmNUe90IgwmWI5PUiK_cn_tXIL5NWo77QutbGfUxjRy3dgNSfSHsoh8L5TxYwr46uNnXFZ19pOLtg3mkFjoBD4GvP5f-jWTffWHMnm1itykInsiiMXpWKcT4WJMrHXDCuTiZqgPoSwYhIQDKrOyby5Jv2CNudc-gdZB1qrjhIYLaDiFb_7jt3vVdxtKD27Qwtrepwt7FrMJOe9vt45O1CsizRFH-VASQQGhNGNu1ZotQGxXF6ZTyiOtc0VCW2W0aFOjD=dTK7gBbWXjMLwv9BqJayAW1bQ4nKB_YPiOqfMdrxyqGGfkIeF5B-kfDqwLxT7d0bnoEy_sYPczpXYd5Id9L4jza1F=A0ozbsqLCL6ZeyjfY31Cr88GiUUzCAw6tzo1HK4KxNIacX0rvJ08jp=--TKX6rCYcFJYpUMDmGxn4DhWGdIRK6prLC=qwH3SXo9o9RyWj6WqkNUby2sgJaTJR3YJAdyY2QWncm7aHXMBR_S2E7tzaYIIA62zdN4zmgHKTWCGwObwJVxaAsZXWZ-GgoGnIyG_g3ETDLQrHNURIWR3OtaKUd_DFNPayA6ReNv0TrwgoEAq6sdFBjpK2Qe4jLF3HF47H6371yjfd34GT3Qv2K47=uTxFsTLCDtBraYROW5oD0DWqDhqJ06euvWwfS8E-gHmciqPNS8KHFV7oc4brAdBfXOY1yAyUgh16UnKXZruY91mvkdNROjMumkOZ-Uai9jAagG30AFsFEpP662bXimXz=hzRc9-JYGPqDwuaK4DiCqPvrG8=r7z_W1hg4mRA0INegG5v4I7MZAGam6rDM4Oa0f17=e066oXNDrYPtMzUSk=bnKx59bHNvY1GjLumAsjkhCwQTxAufRLP37n6vMzSVtCoH_PgF5NykyUv60Vs6W2O6DqmdNMw9ijRWZH5pn=5AkSVmQ7x-xHoyOi4cG1m82x_GTFu5OJKvquiEbda3ZvDP55biqbqfABr4VZSNV1oHVQKEFBmYGtpzMN9tSGw69pQIV6BaSpUnSQVVgY_tRZURB30_IbnGL2o-zpwJ_N69xU3Zx37o-HHDYS96G2kL2O3YYWgGRWRY20HA0qpJpsdBQp7ybPfQ7OXPt2qiqDcLHaKnu9W7kAIB6VUJhgWEnFCLaOW15Yb14df3mhbSpVgrI_ghS=pc2-TKdyT741gK1gReDJ9ADcjqDzj-CVJXo8DgLpG9EjxoLEdJPt3jjgK7SROp913FVEgsoXzVTKpDIbtW9c4DxED_NknCTQkJMwaf_t_myg4E9dTkzBVt-g79TK9m1Ovg0vAyyAg14H5C8g=-9mNhkHmyqaUBLo6INMx6aLcMPMFSu=mO84CudqWBjVUr29e8abn3Cgr30gGPbPj=8N7LbNZCGjLEG0ifWWzxvb5F4TceCKT5gt6v-IIByVM12eqmK1yXeAP1a7yvEfaTrbB4Vr9NsdY-FR-MkMcjEoe_8U-mjkaz5s1P9Y4XAtq=DXFwLUirdm3JpdEp_sNZJvQYy7-Ph9gf49M=fiCEjxLSyn2ZVham6P8OxZ7hHr5tZxOH9ZGv=sQw5TRx5zR3paGB=JzE1y8EvMVRSxtZei7XMM=kUtsObydy9HWLZVkjxPR7HcnpjJCz__qjCCTLDHeQWYu29_hn4JMPgDosZ06m0uI2oPrQ9fdRGZhVcX-V57UzEYjdGtIa-yZ9HiZ46j70ySJx0o-vtG3IP8aTVgonq=21YNiMTcrwEru6jiUMkM7PLoRcujVXQY4ALw4ocaFQfm0iUE97dLHZ4e2QcyeYN89Q=VG-OBu0pGr-RQPONqbVhLKmFMjgN1sBW1DbpOvWVznAxQNySsquBFu4D-kp1kqjy=3G7nr6SjIsYYeyPVmBPMwa3cHr7uGFR4=XkBPDKvCWwd3TxeT38zXQB9xATJcmtmQphozsf3wTIjy4GJTa9IWNIDkhOphr=QB8cIikV67JTtAedMTOz3YBzMG9_bDyAkpNzatT6U30w6Rqh2-B7=o-4R20fH819m_GH9wi6Zt4MXdhPbVL76_F2ZZiRsLtmXIUywxixhVMahrEsQNiKEu3hN7cukDXQICpfKPDkz-7E7eAWcsZhk23OPYyf9AuvqUHH=1dVc1w1nDUmwfDr0Anyv-KW5WoyRG8jfNy0CoeN98NqgqFg0JkaP1pUQK7BxV45J75ORyRJaRJraw_5j-_6b42VI89-UDEiAoAKQJ_j9kyMaqUvXTQP2yX7rsQsB9sGIZnJvAqnEN4pKEwvGG4b6SbEgqw-Msqu-43i-WamMEYHIiZBJGcHume4dEBpMqpFzzp41sgRAIpZABTqDnFw12VAOXwB=kWc4r6WmxZn2yGh5NtAATFFkz_bfK9N-yEProBQWWt8pAHQm42x1R1=3nMD6kv9Cuj2UiA76jrDwwupebnN25ByJ2OnTqFpYWvAr=g-im0_nFadZap9XVqi9Mu3L8gsN7vZ9kT6DbimQCworcFQzHSuc-8FAXtKBWS5N0XXI8Y4vyikvAz15rODsTqBb0fMBSpTM=YEpuqWvxUqVj8RLmnfKKAD1pmbVn-KIT__up5ueAds7M0ftrDDtIjE9-Eknaqkr3RwmH7X-xx4q-9b18NsEPEO0yenZHa=AASfvbdtKjJETM9Hf0QEQ5cuhOZ6oZPJE8Bupk55AnzKSnAfcsji8u1nQapsn2CUSmxFb5L7=TxMIroq=FOKSuYgz7Q4SEgM7j5a2ZGPcsXMeBzGqRTdx1HpGveCb-jAtZ1WY1pb8rKwaWQyGQmgyTgZSLdnSEi6dXaZdGa5ynKerLW2h8fXaDa0zkBS3WjbsKU4rSxB-oSjQBrbXbejXs7VWIyd5I5p1Nr0ZKbL=cog=w4T4xNxUgzokQDnoLftryMwruAArkVdx7dO9wbXwrDtEmGr_JfZ60Kx-Yx1cdVRxq6NPN0ym0Z9bDi7HQAsTuXaaapeYDybJvLNi0WMge=N1sz2hWinw6QDcRDVCdd_ZYewtZGH71XUMr1kpLmpZ96dn6XUf-7swszWMXbmQ0r1dTykFfa4AhjF7p5avpa_ntPWmnYG3wx=TiVMEgwNkUqAn26f8XzyF9O-DLfEHE_Ny2t-nq=2QLLhE-n7Ri3SHC1zJyTMEUQDS9TbXNzsx760ainWOn4I3EZ2_-VOGyIrpAe6STYKBFZ7xfwcgFFbZe-BSBcYot6_RzubRboc8kZxLV3uXtAsf0=K4ohkZ3CM86E39ob5PYs1Q=DtvusdskjDPTLAOJGUCvJWN=jrW=7-ux9qn1XmvKN2I90epYFHvtzGA78zU4YIxuIA_a6MCsp8O9jK-YaTqEkEP3YK261gEx1YEw2n3vVwpPbKGxfRWuuj1nj3R=jwXDaOP8oHj4km6V8Lfv4GuLI4q=VF2jM-Szv3ZWpsypLExT0mbzwDdIKRh6dNIvHZZPnAWuAokzSIvTb1xQ3z1iEqqN3GjZJWp-Nofz46oeARFvsNfHYJdo3jntksGJdC4ZJ7Urvxu1cjqufzXnWxUOrDJb48B2YqmjpCMyWTUn3o74Du2j9WZ76I=XuK39ezjouzRAoxOkpTNaEi76oJIwSO23xyZVyubsxkHwm3E0mtY9ESoED9arKUUWG9_Q-paSFnAk3THOPfTzz4iBRvuJA4khe8P162MqraI1AV=jVSUwkC7juSWzsgkE8W80VByF_U_JSvVMcRbKJ=vCisJaS2cJWENhZyAhMyitPQPznR1E6NI2AdcgCVatyYYaHBtf41f=Vhoaox6v5vNx1P3ZrIGTF8zH-E5raBCdwM-_BvGRHXYfMmpPoHc_1qA_AvSCIJYuQU1tJ1TC3a9rFWRtjWJCNzPJGw6DQJgKS-oLOJjD=xFVQIfrXRLC1duOB97mqdGK2p_imZSd5Zxa8qzJ_LAgGO62nLvsfCMq5SEdsJ_Z11xcemRhpoj0_Xx13e-57I_FjwLavv6EoHXfYMxsiRK5DuYrYByax5CRAAeN20wSbXmsN06FhPSTxgF9z7itwDCNzw17C8VTV2MXSQzT7d5RtL437GDqyLTRIB=i5WWOG',
        'XvPW5hYbpt-b': process.env.LKQ_SECURITY_TOKEN_B || 'ty7z2q',
        'XvPW5hYbpt-c': process.env.LKQ_SECURITY_TOKEN_C || 'AEDjhkaVAQAAETa8zNZRZ1e18-tacDRcKYU1yDGx7_FoKthm6IPmTIc53NLJ',
        'XvPW5hYbpt-d': process.env.LKQ_SECURITY_TOKEN_D || 'ADaAhIDBCKGBgQGAAYIQgISigaIAwBGAzPpCxg_32ocxnsD_CACD5kyHOdzSyf_____6SJXVAlAClszIK58y_zEBimy87Rg',
        'XvPW5hYbpt-f': process.env.LKQ_SECURITY_TOKEN_F || 'Aw79ikaVAQAAcRrkvH9HoabJPBFNsrUjOusvHahnCl7UOfE7lFHKSjU45POyAdiDTdKucpbCwH8AADQwAAAAAA==',
        'XvPW5hYbpt-z': process.env.LKQ_SECURITY_TOKEN_Z || 'q',
      },
    },
    // Add configuration for other scrapers here
  },
};

module.exports = config; 