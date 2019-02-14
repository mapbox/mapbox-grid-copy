'use strict';

const cf = require('@mapbox/cloudfriend');

module.exports = {
  "AWSTemplateFormatVersion": "2010-09-09",
  "Description": "Travis user for testing mapbox-grid-copy",
  "Resources": {
    "MapboxGridCopyTestUser": {
      "Type": "AWS::IAM::User",
      "Properties": {
        "Path": "/service/",
        "Policies": [
          {
            "PolicyName": "mapbox-grid-copy-test",
            "PolicyDocument": {
              "Statement": [
                {
                  "Resource": [
                    "arn:aws:s3:::tilestream-tilesets-development/*"
                  ],
                  "Action": [
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:PutObjectAcl"
                  ],
                  "Effect": "Allow"
                },
                {
                  "Resource": [
                    "arn:aws:s3:::tilestream-tilesets-development"
                  ],
                  "Action": [
                    "s3:ListBucket"
                  ],
                  "Effect": "Allow"
                }
              ]
            }
          }
        ]
      }
    },
    AccessKey: {
      Type: 'AWS::IAM::AccessKey',
      Properties: {
        UserName: cf.ref('MapboxGridCopyTestUser')
      }
    }
  },
  Outputs: {
    AccessKeyId: { Value: cf.ref('AccessKey') },
    SecretAccessKey: { Value: cf.getAtt('AccessKey', 'SecretAccessKey') }
  }
};
